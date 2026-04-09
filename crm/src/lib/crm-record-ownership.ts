import type { EnterpriseRecord } from "@prisma/client";
import { prisma } from "./prisma";
import { normalizeManagerName } from "./crm-enterprise-categories";

/** 返回记录本身，若不存在或不属于该客户经理（分中心负责人）则 null */
export async function assertEnterpriseOwnedByManager(
  recordId: number,
  managerDisplayName: string
): Promise<EnterpriseRecord | null> {
  const n = normalizeManagerName(managerDisplayName);
  if (!n) return null;
  const r = await prisma.enterpriseRecord.findUnique({ where: { id: recordId } });
  if (!r?.branchOwnerName) return null;
  if (normalizeManagerName(r.branchOwnerName) !== n) return null;
  return r;
}
