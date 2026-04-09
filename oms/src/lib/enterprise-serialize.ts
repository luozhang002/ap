import type { EnterpriseRecord } from "@prisma/client";

/** API 返回时把 Decimal 转为字符串，便于前端展示 */
export function serializeEnterpriseRecord(r: EnterpriseRecord) {
  return {
    ...r,
    quotaAmount: r.quotaAmount?.toString() ?? null,
    bestPackagePrice: r.bestPackagePrice?.toString() ?? null,
    referencePrice: r.referencePrice?.toString() ?? null,
    bankHistoricalPrice: r.bankHistoricalPrice?.toString() ?? null,
  };
}
