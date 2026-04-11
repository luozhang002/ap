import { analyzeEnterpriseImport } from "@/lib/enterprise-import-dedupe";
import { getOmsUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** 导入前分析：与库内企业名称（客户名称）重复及字段差异 */
export async function POST(req: Request) {
  const admin = await getOmsUser();
  if (!admin) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传 Excel 文件" }, { status: 400 });
  }

  const originalName = file.name || "import.xlsx";

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await analyzeEnterpriseImport(prisma, buf, originalName);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "分析失败";
    console.error("[enterprises/import/analyze]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
