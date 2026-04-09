import { NextResponse } from "next/server";
import { getOmsUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** 最近导入批次（筛选下拉） */
export async function GET() {
  try {
    const admin = await getOmsUser();
    if (!admin) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const batches = await prisma.enterpriseImportBatch.findMany({
      orderBy: { id: "desc" },
      take: 80,
      select: {
        id: true,
        fileName: true,
        createdAt: true,
        rowCountYilei: true,
        rowCountFeichanggui: true,
        rowCountJieliebang: true,
      },
    });

    return NextResponse.json({ batches });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "服务器错误";
    console.error("[enterprises/batches]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
