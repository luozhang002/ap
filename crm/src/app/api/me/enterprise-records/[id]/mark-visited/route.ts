import { NextResponse } from "next/server";
import { assertEnterpriseOwnedByManager } from "@/lib/crm-record-ownership";
import { mergeExtraJsonMapPosition } from "@/lib/extra-json-map";
import { getCrmUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/** 标记为已拜访（陌拜地图），可选同时写入地图坐标到 extraJson */
export async function POST(req: Request, ctx: Params) {
  const user = await getCrmUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "无效的记录 ID" }, { status: 400 });
  }

  let body: { mapLng?: number; mapLat?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* 允许空 body */
  }

  const record = await assertEnterpriseOwnedByManager(id, user.name);
  if (!record) {
    return NextResponse.json({ error: "记录不存在或无权限" }, { status: 404 });
  }

  const now = new Date();
  const lng = body.mapLng;
  const lat = body.mapLat;
  const hasCoords =
    typeof lng === "number" && typeof lat === "number" && Number.isFinite(lng) && Number.isFinite(lat);

  await prisma.enterpriseRecord.update({
    where: { id },
    data: {
      actuallyVisited: true,
      actualVisitTime: now,
      ...(hasCoords ? { extraJson: mergeExtraJsonMapPosition(record.extraJson, lng, lat) } : {}),
    },
  });

  return NextResponse.json({ ok: true, id });
}
