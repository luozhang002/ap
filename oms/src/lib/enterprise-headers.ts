/**
 * Excel 表头（及常见变体）→ Prisma EnterpriseRecord 字段名。
 * 未匹配的列在导入时写入 extraJson。
 */

export function normalizeHeader(raw: string): string {
  return raw
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .trim();
}

/** 规范化后的表头 → 字段名 */
const HEADER_MAP: Record<string, string> = {};

function add(canonical: string, field: string) {
  HEADER_MAP[normalizeHeader(canonical)] = field;
}

// 下发时间
add("下发时间 (不可改)", "issueTime");
add("下发时间(不可改)", "issueTime");
add("下发时间", "issueTime");

add("提供时间", "provideTime");

add("地区", "region");
add("所在区", "district");
add("ccif", "ccif");
add("CCIF", "ccif");

add("客户名称", "customerName");
add("下发的地址", "issuedAddress");
add("地址核验标签（行方录入）", "addressVerifyLabelBank");
add("地址核验标签(行方录入)", "addressVerifyLabelBank");

add("额度", "quotaAmount");
add("当前最优套餐价格", "bestPackagePrice");
add("新/存 客", "newOrExistingCustomer");
add("新/存客", "newOrExistingCustomer");

add("是否为MGM客户", "isMgmCustomer");
add("最近一次授信成功时间", "lastCreditSuccessTime");
add("锁期时间", "lockPeriodEnd");
add("当前套餐还款方式", "repaymentMethod");

add("参考价", "referencePrice");
add("我行参考历史价", "bankHistoricalPrice");
add("是否可用折扣券", "discountCouponAvailable");
add("预计金额违约率是否大于9", "defaultRateOver9");

add("负责人", "ownerName");
add("分中心负责人", "branchOwnerName");
add("法人姓名", "legalPersonName");
add("联系电话", "contactPhone");
add("实际经营地址", "actualBusinessAddress");

add("首次联系时间", "firstContactTime");
add("首次接通时间", "firstConnectTime");
add("最新一次联系时间（多次联系的填写）", "latestContactTime");
add("最新一次联系时间(多次联系的填写)", "latestContactTime");
add("最新一次接通时间", "latestConnectTime");
add("最近一次上门时间", "lastVisitTime");

add("联系次数", "contactCount");
add("确认客户是否有意愿", "hasCustomerIntent");
add("未触达原因", "unreachableReason");
add("预约上门时间", "scheduledVisitTime");
add("label", "labelTag");
add("Label", "labelTag");

add("是否实际上门", "actuallyVisited");
add("实际上门时间", "actualVisitTime");
add("是否见到客户", "metCustomer");
add("是否疑似风险客户（客户经理独立意见）", "suspectedRisk");
add("是否疑似风险客户(客户经理独立意见)", "suspectedRisk");

add("渠道", "channel");
add("电销备注", "telemarketingNote");
add("接力棒标签", "relayTag");
add("影像资料", "imageMaterials");
add("是否完成地址核验", "addressVerified");

add("登记时间", "registerTime");
add("今天登记次数", "todayRegisterCount");
add("父记录", "parentRecordRef");
add("父记录 2", "parentRecordRef2");
add("父记录2", "parentRecordRef2");

add("联系/走访情况备注", "visitRemark");

export function resolveHeaderToField(headerCell: string): string | null {
  const n = normalizeHeader(headerCell);
  if (!n) return null;
  return HEADER_MAP[n] ?? null;
}

export function isKnownField(field: string): boolean {
  const known = new Set(Object.values(HEADER_MAP));
  return known.has(field);
}
