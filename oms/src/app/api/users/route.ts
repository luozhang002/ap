import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getOmsUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD = 6;

/** GET：管理员下列出全部用户（不含密码） */
export async function GET() {
  const admin = await getOmsUser();
  if (!admin) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const list = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { id: "asc" }],
    select: { id: true, username: true, name: true, role: true },
  });

  return NextResponse.json({ users: list });
}

/** POST：仅管理员，创建普通员工账号 */
export async function POST(req: Request) {
  const admin = await getOmsUser();
  if (!admin) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { username?: string; name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const username = body.username?.trim();
  const name = body.name?.trim();
  const password = body.password ?? "";

  if (!username || !name || !password) {
    return NextResponse.json({ error: "请填写用户名、姓名和密码" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `密码至少 ${MIN_PASSWORD} 位` }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      name,
      password: hash,
      role: Role.EMPLOYEE,
    },
    select: { id: true, username: true, name: true, role: true },
  });

  return NextResponse.json({ user });
}
