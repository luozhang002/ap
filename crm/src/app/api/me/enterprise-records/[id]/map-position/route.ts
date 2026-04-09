import { NextResponse } from "next/server";
import { assertEnterpriseOwnedByManager } from "@/lib/crm-record-ownership";
import { mergeExtraJsonMapPosition } from "@/lib/extra-json-map";
import { getCrmUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** 缓存地理编码结果到 extraJson.mapLng / mapLat，减少重复请求 */
export async function POST(req: Request, ctx: Params) {
  const user = await getCrmUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "无效的记录 ID" }, { status: 400 });
  }

  let body: { lng?: unknown; lat?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const lng = typeof body.lng === "number" ? body.lng : Number(body.lng);
  const lat = typeof body.lat === "number" ? body.lat : Number(body.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return NextResponse.json({ error: "需要有效的 lng、lat" }, { status: 400 });
  }

  const record = await assertEnterpriseOwnedByManager(id, user.name);
  if (!record) {
    return NextResponse.json({ error: "记录不存在或无权限" }, { status: 404 });
  }

  const extraJson = mergeExtraJsonMapPosition(record.extraJson, lng, lat);
  await prisma.enterpriseRecord.update({
    where: { id },
    data: { extraJson },
  });

  return NextResponse.json({ ok: true });
}
