import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getOmsUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD = 6;

type Params = { params: Promise<{ id: string }> };

/** PATCH：管理员修改自己或普通员工的姓名/密码；不可改其他管理员 */
export async function PATCH(req: Request, ctx: Params) {
  const admin = await getOmsUser();
  if (!admin) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "无效的用户 ID" }, { status: 400 });
  }

  let body: { name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const isSelf = admin.id === target.id;
  const isEmployee = target.role === Role.EMPLOYEE;

  if (!isSelf && !isEmployee) {
    return NextResponse.json({ error: "不能修改其他管理员账号" }, { status: 403 });
  }

  const name = body.name?.trim();
  const password = body.password;

  if (name === undefined && password === undefined) {
    return NextResponse.json({ error: "请提供姓名或新密码" }, { status: 400 });
  }

  const data: { name?: string; password?: string } = {};
  if (name !== undefined) {
    if (!name) {
      return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
    }
    data.name = name;
  }
  if (password !== undefined) {
    if (!password) {
      return NextResponse.json({ error: "密码不能为空" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `密码至少 ${MIN_PASSWORD} 位` }, { status: 400 });
    }
    data.password = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, name: true, role: true },
  });

  return NextResponse.json({ user: updated });
}

/** DELETE：仅可删除普通员工；管理员账号不可删除 */
export async function DELETE(_req: Request, ctx: Params) {
  const admin = await getOmsUser();
  if (!admin) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "无效的用户 ID" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  if (target.role !== Role.EMPLOYEE) {
    return NextResponse.json({ error: "不能删除管理员账号" }, { status: 403 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
