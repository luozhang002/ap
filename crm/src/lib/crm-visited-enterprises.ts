import type { EnterpriseSheetKind } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { normalizeManagerName } from "./crm-enterprise-categories";

const SHEET_LABEL: Record<string, string> = {
  YILEI: "一类",
  FEICHANGGUI: "非常规名单",
  JIELIEBANG: "接力棒",
};

export type ManagerEnterpriseCard = {
  id: number;
  customerName: string | null;
  sheetKind: EnterpriseSheetKind;
  sheetKindLabel: string;
  issuedAddress: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  /** 是否已拜访：实际上门为是，或存在最近/实际上门时间 */
  isVisited: boolean;
  lastVisitTime: string | null;
  actualVisitTime: string | null;
  contactPhone: string | null;
  /** 法人姓名（与 OMS / Excel「法人姓名」一致） */
  legalPersonName: string | null;
  visitRemark: string | null;
};

function fmtDisplay(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("zh-CN", { hour12: false });
}

/** 与列表 / 地图一致：是否已拜访 */
export function rowIsVisited(r: {
  actuallyVisited: boolean | number | bigint | null;
  lastVisitTime: Date | null;
  actualVisitTime: Date | null;
}): boolean {
  const v = r.actuallyVisited;
  const av = v === true || v === 1 || v === BigInt(1);
  return av || r.lastVisitTime != null || r.actualVisitTime != null;
}

/** 首页 / 接口分页默认条数 */
export const MANAGER_ENTERPRISES_DEFAULT_LIMIT = 20;
export const MANAGER_ENTERPRISES_MAX_LIMIT = 100;

function mapRowsToCards(
  rows: Array<{
    id: number;
    customerName: string | null;
    sheetKind: EnterpriseSheetKind;
    issuedAddress: string | null;
    province: string | null;
    city: string | null;
    district: string | null;
    actuallyVisited: boolean | number | bigint | null;
    lastVisitTime: Date | null;
    actualVisitTime: Date | null;
      contactPhone: string | null;
      legalPersonName: string | null;
      visitRemark: string | null;
    }>,
): ManagerEnterpriseCard[] {
  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    sheetKind: r.sheetKind,
    sheetKindLabel: SHEET_LABEL[r.sheetKind] ?? r.sheetKind,
    issuedAddress: r.issuedAddress,
    province: r.province,
    city: r.city,
    district: r.district,
    isVisited: rowIsVisited(r),
    lastVisitTime: fmtDisplay(r.lastVisitTime),
    actualVisitTime: fmtDisplay(r.actualVisitTime),
    contactPhone: r.contactPhone,
    legalPersonName: r.legalPersonName,
    visitRemark: r.visitRemark,
  }));
}

/**
 * 客户经理名下企业分页（按 id 倒序）。`cursor` 为上一页最后一条的 id，下一页 `WHERE id < cursor`。
 */
export async function queryManagerEnterprises(
  userDisplayName: string,
  options: {
    cursor?: number;
    limit: number;
    nameQ?: string;
    cityQ?: string;
  },
): Promise<{
  items: ManagerEnterpriseCard[];
  nextCursor: number | null;
  hasMore: boolean;
}> {
  const n = normalizeManagerName(userDisplayName);
  if (!n) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const nameTrim = (options.nameQ ?? "").trim();
  const cityTrim = (options.cityQ ?? "").trim();
  const limit = Math.min(Math.max(1, options.limit), MANAGER_ENTERPRISES_MAX_LIMIT);
  const take = limit + 1;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`ownerName IS NOT NULL AND TRIM(ownerName) = ${n}`,
  ];
  if (options.cursor != null && Number.isFinite(options.cursor)) {
    conditions.push(Prisma.sql`id < ${options.cursor}`);
  }
  if (nameTrim) {
    conditions.push(Prisma.sql`(customerName IS NOT NULL AND LOCATE(${nameTrim}, customerName) > 0)`);
  }
  if (cityTrim) {
    conditions.push(
      Prisma.sql`(
        LOCATE(${cityTrim}, IFNULL(city,'')) > 0
        OR LOCATE(${cityTrim}, IFNULL(province,'')) > 0
        OR LOCATE(${cityTrim}, IFNULL(district,'')) > 0
      )`,
    );
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

  const rows = await prisma.$queryRaw<
    Array<{
      id: number;
      customerName: string | null;
      sheetKind: EnterpriseSheetKind;
      issuedAddress: string | null;
      province: string | null;
      city: string | null;
      district: string | null;
      actuallyVisited: boolean | number | bigint | null;
      lastVisitTime: Date | null;
      actualVisitTime: Date | null;
      contactPhone: string | null;
      legalPersonName: string | null;
      visitRemark: string | null;
    }>
  >(
    Prisma.sql`
      SELECT id, customerName, sheetKind, issuedAddress, province, city, district,
             actuallyVisited, lastVisitTime, actualVisitTime, contactPhone, legalPersonName, visitRemark
      FROM enterprise_records
      ${whereClause}
      ORDER BY id DESC
      LIMIT ${take}
    `,
  );

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const items = mapRowsToCards(slice);
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return { items, nextCursor, hasMore };
}

/**
 * 客户经理（`ownerName`，与 OMS「客户经理」/ 导入一致）名下企业，最多 500 条（兼容旧逻辑）。
 */
export async function getEnterprisesForManager(userDisplayName: string): Promise<{
  items: ManagerEnterpriseCard[];
}> {
  const { items } = await queryManagerEnterprises(userDisplayName, { limit: 500 });
  return { items };
}

/**
 * 与列表/地图相同的「已拜访」判定，统计当前登录姓名在「客户经理」名下企业数量。
 */
export async function getManagerVisitStats(userDisplayName: string): Promise<{
  total: number;
  visited: number;
  unvisited: number;
}> {
  const n = normalizeManagerName(userDisplayName);
  if (!n) {
    return { total: 0, visited: 0, unvisited: 0 };
  }

  const rows = await prisma.$queryRaw<
    Array<{
      total: bigint;
      visited: bigint;
    }>
  >(
    Prisma.sql`
      SELECT
        COUNT(*) AS total,
        COALESCE(
          SUM(
            CASE
              WHEN (
                actuallyVisited = 1
                OR lastVisitTime IS NOT NULL
                OR actualVisitTime IS NOT NULL
              )
                THEN 1
              ELSE 0
            END
          ),
          0
        ) AS visited
      FROM enterprise_records
      WHERE ownerName IS NOT NULL
        AND TRIM(ownerName) = ${n}
    `,
  );

  const r = rows[0];
  const total = Number(r?.total ?? 0);
  const visited = Number(r?.visited ?? 0);
  const unvisited = Math.max(0, total - visited);
  return { total, visited, unvisited };
}
