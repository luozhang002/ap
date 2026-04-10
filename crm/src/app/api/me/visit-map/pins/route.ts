import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { rowIsVisited } from "@/lib/crm-visited-enterprises";
import { parseMapCoordsFromExtra } from "@/lib/extra-json-map";
import { normalizeManagerName } from "@/lib/crm-enterprise-categories";
import { getCrmUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const SHEET_LABEL: Record<string, string> = {
  YILEI: "一类",
  FEICHANGGUI: "非常规名单",
  JIELIEBANG: "接力棒",
};

/** 陌拜地图：当前客户经理名下企业点（含 extraJson 缓存坐标） */
export async function GET() {
  const user = await getCrmUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const n = normalizeManagerName(user.name);
  if (!n) {
    return NextResponse.json({ pins: [] });
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: number;
      customerName: string | null;
      sheetKind: string;
      issuedAddress: string | null;
      actualBusinessAddress: string | null;
      province: string | null;
      city: string | null;
      district: string | null;
      actuallyVisited: boolean | number | bigint | null;
      lastVisitTime: Date | null;
      actualVisitTime: Date | null;
      extraJson: Prisma.JsonValue | null;
    }>
  >(
    Prisma.sql`
      SELECT id, customerName, sheetKind, issuedAddress, actualBusinessAddress, province, city, district,
             actuallyVisited, lastVisitTime, actualVisitTime, extraJson
      FROM enterprise_records
      WHERE branchOwnerName IS NOT NULL
        AND TRIM(branchOwnerName) = ${n}
      ORDER BY id DESC
      LIMIT 500
    `,
  );

  const pins = rows.map((r) => {
    const visited = rowIsVisited({
      actuallyVisited: r.actuallyVisited,
      lastVisitTime: r.lastVisitTime,
      actualVisitTime: r.actualVisitTime,
    });
    const coords = parseMapCoordsFromExtra(r.extraJson);
    const addrFromIssued = [r.issuedAddress, r.actualBusinessAddress].find((s) => s?.trim())?.trim();
    const addrFromRegion = [r.province, r.city, r.district].filter(Boolean).join(" · ");
    let addr = "";
    if (addrFromIssued) {
      addr = addrFromIssued;
    } else if (addrFromRegion) {
      addr = addrFromRegion;
    }
    const sheetKindLabel = SHEET_LABEL[r.sheetKind as keyof typeof SHEET_LABEL];
    return {
      id: r.id,
      name: r.customerName?.trim() || `企业 #${r.id}`,
      company: sheetKindLabel !== undefined ? sheetKindLabel : r.sheetKind,
      address: addr,
      latitude: coords === null ? null : coords.lat,
      longitude: coords === null ? null : coords.lng,
      visitStatus: visited ? ("VISITED" as const) : ("UNVISITED" as const),
      visitedAt: r.actualVisitTime
        ? r.actualVisitTime.toISOString()
        : r.lastVisitTime
          ? r.lastVisitTime.toISOString()
          : null,
      province: r.province,
      city: r.city,
      district: r.district,
    };
  });

  return NextResponse.json({ pins });
}
