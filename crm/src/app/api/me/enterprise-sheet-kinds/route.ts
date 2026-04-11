import { NextResponse } from "next/server";
import { getCrmUser } from "@/lib/session";
import { getSheetKindsForManagerName } from "@/lib/crm-enterprise-categories";

/** 当前登录员工按姓名匹配「客户经理」（ownerName）后，返回其涉及的企业类别（Sheet）及条数 */
export async function GET() {
  const user = await getCrmUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { kinds } = await getSheetKindsForManagerName(user.name);
  return NextResponse.json({ kinds });
}
