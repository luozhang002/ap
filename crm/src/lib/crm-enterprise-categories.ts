import type { EnterpriseSheetKind } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** 勿使用 `EnterpriseSheetKind.YILEI` 等运行时枚举：部分打包场景下 `@prisma/client` 的 enum 可能未就绪 */
const LABEL: Record<EnterpriseSheetKind, string> = {
  YILEI: "一类",
  FEICHANGGUI: "非常规名单",
  JIELIEBANG: "接力棒",
};

export const SHEET_KIND_ORDER: readonly EnterpriseSheetKind[] = [
  "YILEI",
  "FEICHANGGUI",
  "JIELIEBANG",
];

export type ManagerSheetKindRow = {
  sheetKind: EnterpriseSheetKind;
  label: string;
  count: number;
};

/** 与 Excel「分中心负责人」（客户经理）对齐：首尾空白折叠，便于与导入数据匹配 */
export function normalizeManagerName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * 按客户经理姓名（与 enterprise_records.branchOwnerName / Excel「分中心负责人」一致）统计其涉及的企业类别（Sheet 类型）及行数。
 */
export async function getSheetKindsForManagerName(userDisplayName: string): Promise<{
  kinds: ManagerSheetKindRow[];
}> {
  const n = normalizeManagerName(userDisplayName);
  if (!n) {
    return { kinds: [] };
  }

  const rows = await prisma.$queryRaw<Array<{ sheetKind: EnterpriseSheetKind; cnt: bigint }>>(
    Prisma.sql`
      SELECT sheetKind, COUNT(*) AS cnt
      FROM enterprise_records
      WHERE branchOwnerName IS NOT NULL AND TRIM(branchOwnerName) = ${n}
      GROUP BY sheetKind
    `,
  );

  const byKind = new Map(rows.map((r) => [r.sheetKind, Number(r.cnt)]));
  const kinds = SHEET_KIND_ORDER.filter((k) => byKind.has(k)).map((sheetKind) => ({
    sheetKind,
    label: LABEL[sheetKind],
    count: byKind.get(sheetKind)!,
  }));

  return { kinds };
}
