import type { Prisma } from "@prisma/client";
import { chunk, parseEnterpriseWorkbook } from "@/lib/enterprise-import";
import { getOmsUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const CREATE_CHUNK = 500;

export async function POST(req: Request) {
  const admin = await getOmsUser();
  if (!admin) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "请上传 Excel 文件" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const originalName = file.name || "import.xlsx";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const push = (obj: object) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      try {
        push({
          type: "progress",
          percent: 2,
          step: "receive",
          message: "接收文件…",
        });

        const buf = Buffer.from(await file.arrayBuffer());

        push({
          type: "progress",
          percent: 6,
          step: "read",
          message: "读取完成，开始解析工作表…",
        });

        let parsed: ReturnType<typeof parseEnterpriseWorkbook>;
        try {
          parsed = parseEnterpriseWorkbook(buf, (p) => {
            push({
              type: "progress",
              percent: 10 + (p.sheetIndex + 1) * 8,
              step: "parse_sheet",
              message: `「${p.kindLabel}」${p.sheetName ? `(${p.sheetName})` : ""}：已解析 ${p.rowCount} 行`,
              sheetIndex: p.sheetIndex,
              rowCount: p.rowCount,
            });
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "解析失败";
          push({ type: "error", message: msg });
          controller.close();
          return;
        }

        const rowCountYilei = parsed.rowsBySheet[0].length;
        const rowCountFeichanggui = parsed.rowsBySheet[1].length;
        const rowCountJieliebang = parsed.rowsBySheet[2].length;
        const allRows = [
          ...parsed.rowsBySheet[0],
          ...parsed.rowsBySheet[1],
          ...parsed.rowsBySheet[2],
        ];

        push({
          type: "progress",
          percent: 36,
          step: "prepare_db",
          message: `共解析 ${allRows.length} 行，准备写入数据库…`,
        });

        const batch = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const b = await tx.enterpriseImportBatch.create({
            data: {
              fileName: originalName,
              uploadedByUserId: admin.id,
              rowCountYilei,
              rowCountFeichanggui,
              rowCountJieliebang,
            },
          });

          push({
            type: "progress",
            percent: 40,
            step: "batch_created",
            message: `已创建导入批次 #${b.id}`,
          });

          const withBatch = allRows.map((r) => ({
            ...r,
            batchId: b.id,
          }));

          const parts = chunk(withBatch, CREATE_CHUNK);
          const total = parts.length;
          for (let i = 0; i < total; i++) {
            await tx.enterpriseRecord.createMany({ data: parts[i] });
            const pct = 40 + Math.round(((i + 1) / total) * 56);
            push({
              type: "progress",
              percent: Math.min(98, pct),
              step: "insert",
              message: `写入数据库：第 ${i + 1} / ${total} 批（每批最多 ${CREATE_CHUNK} 行）`,
              currentChunk: i + 1,
              totalChunks: total,
            });
          }

          return b;
        });

        push({
          type: "done",
          batch: {
            id: batch.id,
            fileName: batch.fileName,
            sheetNames: parsed.sheetNames,
            rowCountYilei,
            rowCountFeichanggui,
            rowCountJieliebang,
            totalRows: allRows.length,
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "服务器错误";
        console.error("[enterprises/import]", e);
        push({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
