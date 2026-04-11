import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getCrmUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD = 6;

/** 登录员工修改本人密码 */
export async function PATCH(req: Request) {
  const sessionUser = await getCrmUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "请填写当前密码和新密码" }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `新密码至少 ${MIN_PASSWORD} 位` }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "新密码不能与当前密码相同" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 401 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash },
  });

  return NextResponse.json({ ok: true });
}
