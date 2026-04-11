import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { serializeEnterpriseRecord } from "@/lib/enterprise-serialize";
import { getOmsUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** 允许 PATCH 的字符串字段（下发时间等导入锚点字段不可改） */
const PATCHABLE_STRING = new Set([
  "customerName",
  "province",
  "city",
  "district",
  "street",
  "ccif",
  "branchOwnerName",
  "ownerName",
  "legalPersonName",
  "contactPhone",
  "channel",
  "relayTag",
  "telemarketingNote",
  "visitRemark",
  "issuedAddress",
  "actualBusinessAddress",
  "addressVerifyLabel",
  "industry",
  "customerLevel",
  "labelTag",
  "imageMaterials",
  "newOrExistingCustomer",
  "repaymentMethod",
  "unreachableReason",
  "listType",
  "packageName",
  "customerType",
  "returnReason",
]);

const PATCHABLE_BOOL = new Set(["listReturned"]);

function forbiddenKeys(body: Record<string, unknown>): string | null {
  const blocked = ["issueTime", "batchId", "sheetKind", "rowIndex", "id"];
  for (const k of blocked) {
    if (k in body && body[k] !== undefined) {
      return k;
    }
  }
  return null;
}

/** 单条更新 */
export async function PATCH(req: Request, ctx: Params) {
  try {
    const admin = await getOmsUser();
    if (!admin) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const id = Number((await ctx.params).id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "无效的记录 ID" }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "请求体无效" }, { status: 400 });
    }

    const bad = forbiddenKeys(body);
    if (bad) {
      if (bad === "issueTime") {
        return NextResponse.json({ error: "下发时间不可修改" }, { status: 400 });
      }
      return NextResponse.json({ error: `不允许修改字段：${bad}` }, { status: 400 });
    }

    const data: Record<string, string | boolean | null> = {};
    for (const key of PATCHABLE_STRING) {
      if (!(key in body)) continue;
      const v = body[key];
      if (v === null) {
        data[key] = null;
        continue;
      }
      if (typeof v === "string") {
        const t = v.trim();
        data[key] = t === "" ? null : t;
        continue;
      }
      return NextResponse.json({ error: `字段 ${key} 须为字符串或 null` }, { status: 400 });
    }
    for (const key of PATCHABLE_BOOL) {
      if (!(key in body)) continue;
      const v = body[key];
      if (v === null) {
        data[key] = null;
        continue;
      }
      if (typeof v === "boolean") {
        data[key] = v;
        continue;
      }
      return NextResponse.json({ error: `字段 ${key} 须为布尔或 null` }, { status: 400 });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
    }

    const exists = await prisma.enterpriseRecord.findUnique({ where: { id } });
    if (!exists) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    const updated = await prisma.enterpriseRecord.update({
      where: { id },
      data: data as Prisma.EnterpriseRecordUpdateInput,
      include: {
        batch: { select: { id: true, fileName: true, createdAt: true } },
      },
    });

    const { batch, ...record } = updated;
    return NextResponse.json({
      record: { ...serializeEnterpriseRecord(record), batch },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "服务器错误";
    console.error("[enterprises/records PATCH]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 单条删除 */
export async function DELETE(_req: Request, ctx: Params) {
  try {
    const admin = await getOmsUser();
    if (!admin) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const id = Number((await ctx.params).id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "无效的记录 ID" }, { status: 400 });
    }

    const exists = await prisma.enterpriseRecord.findUnique({ where: { id } });
    if (!exists) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    await prisma.enterpriseRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "服务器错误";
    console.error("[enterprises/records DELETE]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
