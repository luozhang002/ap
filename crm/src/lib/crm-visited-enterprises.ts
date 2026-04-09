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
  region: string | null;
  district: string | null;
  /** 是否已拜访：实际上门为是，或存在最近/实际上门时间 */
  isVisited: boolean;
  lastVisitTime: string | null;
  actualVisitTime: string | null;
  contactPhone: string | null;
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

/**
 * 客户经理（Excel「分中心负责人」）名下全部企业（含已拜访与未拜访）。
 */
export async function getEnterprisesForManager(userDisplayName: string): Promise<{
  items: ManagerEnterpriseCard[];
}> {
  const n = normalizeManagerName(userDisplayName);
  if (!n) {
    return { items: [] };
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: number;
      customerName: string | null;
      sheetKind: EnterpriseSheetKind;
      issuedAddress: string | null;
      region: string | null;
      district: string | null;
      actuallyVisited: boolean | number | bigint | null; // raw 查询可能为 0/1
      lastVisitTime: Date | null;
      actualVisitTime: Date | null;
      contactPhone: string | null;
      visitRemark: string | null;
    }>
  >(
    Prisma.sql`
      SELECT id, customerName, sheetKind, issuedAddress, region, district,
             actuallyVisited, lastVisitTime, actualVisitTime, contactPhone, visitRemark
      FROM enterprise_records
      WHERE branchOwnerName IS NOT NULL
        AND TRIM(branchOwnerName) = ${n}
      ORDER BY id DESC
      LIMIT 500
    `,
  );

  const items: ManagerEnterpriseCard[] = rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    sheetKind: r.sheetKind,
    sheetKindLabel: SHEET_LABEL[r.sheetKind] ?? r.sheetKind,
    issuedAddress: r.issuedAddress,
    region: r.region,
    district: r.district,
    isVisited: rowIsVisited(r),
    lastVisitTime: fmtDisplay(r.lastVisitTime),
    actualVisitTime: fmtDisplay(r.actualVisitTime),
    contactPhone: r.contactPhone,
    visitRemark: r.visitRemark,
  }));

  return { items };
}
