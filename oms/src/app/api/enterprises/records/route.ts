import { EnterpriseSheetKind, Prisma, type EnterpriseRecord } from "@prisma/client";
import { NextResponse } from "next/server";
import { serializeEnterpriseRecord } from "@/lib/enterprise-serialize";
import { getOmsUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RecordWithBatch = EnterpriseRecord & {
  batch: { id: number; fileName: string; createdAt: Date };
};

function parseSheetKind(raw: string | null): EnterpriseSheetKind | null {
  if (!raw) return null;
  if (raw === "YILEI" || raw === "FEICHANGGUI" || raw === "JIELIEBANG") {
    return raw as EnterpriseSheetKind;
  }
  return null;
}

/** 列表 + 筛选 + 分页 */
export async function GET(req: Request) {
  try {
    const admin = await getOmsUser();
    if (!admin) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "20")));

    const sheetKind = parseSheetKind(searchParams.get("sheetKind"));
    const batchIdRaw = searchParams.get("batchId");
    const batchId = batchIdRaw ? Number(batchIdRaw) : NaN;
    /** 兼容旧参数：关键词搜客户名/CCIF/电话 */
    const q = (searchParams.get("q") || "").trim();
    const customerName = (searchParams.get("customerName") || "").trim();
    /** 客户经理：对应库字段「分中心负责人」 */
    const branchOwnerName = (searchParams.get("branchOwnerName") || "").trim();
    const region = (searchParams.get("region") || "").trim();
    const district = (searchParams.get("district") || "").trim();
    /** 负责人：对应库字段「负责人」 */
    const ownerName = (searchParams.get("ownerName") || "").trim();
    const issueFrom = searchParams.get("issueFrom");
    const issueTo = searchParams.get("issueTo");

    const conditions: Prisma.EnterpriseRecordWhereInput[] = [];

    if (sheetKind) {
      conditions.push({ sheetKind });
    }
    if (Number.isFinite(batchId) && batchId > 0) {
      conditions.push({ batchId });
    }
    if (q) {
      conditions.push({
        OR: [
          { customerName: { contains: q } },
          { ccif: { contains: q } },
          { contactPhone: { contains: q } },
        ],
      });
    }
    if (customerName) {
      conditions.push({ customerName: { contains: customerName } });
    }
    if (branchOwnerName) {
      conditions.push({ branchOwnerName: { contains: branchOwnerName } });
    }
    if (region) {
      conditions.push({ region: { contains: region } });
    }
    if (district) {
      conditions.push({ district: { contains: district } });
    }
    if (ownerName) {
      conditions.push({ ownerName: { contains: ownerName } });
    }

    if (issueFrom || issueTo) {
      const range: Prisma.DateTimeNullableFilter = {};
      if (issueFrom) {
        const d = new Date(issueFrom);
        if (!Number.isNaN(d.getTime())) range.gte = d;
      }
      if (issueTo) {
        const d = new Date(issueTo);
        if (!Number.isNaN(d.getTime())) range.lte = d;
      }
      if (Object.keys(range).length > 0) {
        conditions.push({ issueTime: range });
      }
    }

    const where: Prisma.EnterpriseRecordWhereInput =
      conditions.length > 0 ? { AND: conditions } : {};

    const [total, rows] = await prisma.$transaction([
      prisma.enterpriseRecord.count({ where }),
      prisma.enterpriseRecord.findMany({
        where,
        orderBy: [{ id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          batch: {
            select: { id: true, fileName: true, createdAt: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize,
      records: rows.map((r: RecordWithBatch) => {
        const { batch, ...record } = r;
        return {
          ...serializeEnterpriseRecord(record),
          batch,
        };
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "服务器错误";
    console.error("[enterprises/records]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
