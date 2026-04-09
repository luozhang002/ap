import { NextResponse } from "next/server";
import { getEnterprisesForManager } from "@/lib/crm-visited-enterprises";
import { getCrmUser } from "@/lib/session";

/** 当前登录客户经理名下全部负责企业（含已拜访/未拜访） */
export async function GET() {
  const user = await getCrmUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { items } = await getEnterprisesForManager(user.name);
  return NextResponse.json({ items });
}
