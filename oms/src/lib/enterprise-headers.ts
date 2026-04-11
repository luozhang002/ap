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

// ── 三个 Sheet 共有字段（模板同步维护，含「名单是否退回」「退回原因」等）──

add("下发时间 (不可改)", "issueTime");
add("下发时间(不可改)", "issueTime");
add("下发时间", "issueTime");

add("提供时间", "provideTime");

add("所在省", "province");
add("所在市", "city");
add("地区", "city"); // 旧模板兼容
add("所在区", "district");
add("所在街道", "street");

add("ccif", "ccif");
add("CCIF", "ccif");

add("客户名称", "customerName");
add("下发地址", "issuedAddress");
add("下发的地址", "issuedAddress"); // 旧模板兼容

add("地址核验标签", "addressVerifyLabel");
add("地址核验标签（行方录入）", "addressVerifyLabel"); // 旧模板兼容
add("地址核验标签(行方录入)", "addressVerifyLabel");

add("行业", "industry");
add("是否完成地址核验", "addressVerified");
add("实际经营地址", "actualBusinessAddress");

add("额度", "quotaAmount");
add("当前最优套餐价格", "bestPackagePrice");
add("新/存 客", "newOrExistingCustomer");
add("新/存客", "newOrExistingCustomer");
add("客户级别", "customerLevel");

add("最近一次授信成功时间", "lastCreditSuccessTime");
add("最新一次授信成功时间", "lastCreditSuccessTime"); // 旧模板兼容
add("锁期时间", "lockPeriodEnd");
add("当前套餐还款方式", "repaymentMethod");

add("参考价", "referencePrice");
add("我行历史参考价", "bankHistoricalPrice");
add("我行参考历史价", "bankHistoricalPrice"); // 旧模板兼容

add("是否可用折扣券", "discountCouponAvailable");
add("预计金额违约率是否大于9", "defaultRateOver9");

add("负责人", "ownerName");
add("客户经理", "ownerName");
add("分中心负责人", "branchOwnerName");
add("法人姓名", "legalPersonName");
add("联系电话", "contactPhone");

add("首次联系时间", "firstContactTime");
add("最近一次上门时间", "lastVisitTime");
add("预约上门时间", "scheduledVisitTime");
add("未触达原因", "unreachableReason");
add("联系/走访情况备注", "visitRemark");

add("label", "labelTag");
add("Label", "labelTag");

add("是否实际上门", "actuallyVisited");
add("实际上门时间", "actualVisitTime");
add("是否见到客户", "metCustomer");

add("名单是否退回", "listReturned");
add("退回原因", "returnReason");

add("渠道", "channel");
add("影像资料", "imageMaterials");
add("登记时间", "registerTime");

// ── 一类 / 接力棒独有字段（10 个）──

add("电销备注", "telemarketingNote");
add("接力棒标签", "relayTag");
add("是否为MGM客户", "isMgmCustomer");
add("是否疑似风险客户（客户经理独立意见）", "suspectedRisk");
add("是否疑似风险客户(客户经理独立意见)", "suspectedRisk");
add("今天登记次数", "todayRegisterCount");
add("首次接通时间", "firstConnectTime");
add("最新一次联系时间（多次联系的填写）", "latestContactTime");
add("最新一次联系时间(多次联系的填写)", "latestContactTime");
add("最新一次接通时间", "latestConnectTime");
add("联系次数", "contactCount");
add("确认客户是否有意愿", "hasCustomerIntent");

// ── 非常规名单独有字段（5 个）──

add("名单类型", "listType");
add("沉默天数", "silentDays");
add("套餐", "packageName");
add("实际经营地址是否和注册地址一致", "addressMatchRegistered");
add("客户类型", "customerType");

export function resolveHeaderToField(headerCell: string): string | null {
  const n = normalizeHeader(headerCell);
  if (!n) return null;
  return HEADER_MAP[n] ?? null;
}

export function isKnownField(field: string): boolean {
  const known = new Set(Object.values(HEADER_MAP));
  return known.has(field);
}
