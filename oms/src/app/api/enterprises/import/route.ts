import type { EnterpriseRecord } from "@prisma/client";
import {
  dedupeWithinFileLastWins,
  loadExistingByCustomerKeys,
  normalizeCustomerKey,
  partitionByImportMode,
  type ImportMode,
} from "@/lib/enterprise-import-dedupe";
import { chunk, parseEnterpriseWorkbook } from "@/lib/enterprise-import";
import { getOmsUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const CREATE_CHUNK = 500;
const UPDATE_CHUNK = 40;

function parseImportMode(raw: FormDataEntryValue | null): ImportMode {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "insert_all" || s === "skip_existing" || s === "upsert") return s;
  return "skip_existing";
}

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

  const importMode = parseImportMode(form.get("importMode"));
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

        const { rows: dedupedRows, internalDropped } =
          dedupeWithinFileLastWins(allRows);

        push({
          type: "progress",
          percent: 32,
          step: "prepare_db",
          message: `解析 ${allRows.length} 行，文件内去重后 ${dedupedRows.length} 行；检查与库内企业名称重复…`,
        });

        const normalizedKeys = dedupedRows
          .map((r) => normalizeCustomerKey(r.customerName))
          .filter((k): k is string => k != null);

        let existingByKey = new Map<string, EnterpriseRecord>();
        if (importMode !== "insert_all" && normalizedKeys.length > 0) {
          existingByKey = await loadExistingByCustomerKeys(
            prisma,
            normalizedKeys
          );
        }

        const { toInsert, toUpdate, skipped } = partitionByImportMode(
          dedupedRows,
          existingByKey,
          importMode
        );

        if (toInsert.length === 0 && toUpdate.length === 0) {
          push({
            type: "error",
            message:
              "没有可写入的数据：在「仅新客户」模式下全部为已存在企业，或文件无有效行。若需以本次 Excel 为准更新库中数据，请选择「覆盖更新」。",
          });
          controller.close();
          return;
        }

        push({
          type: "progress",
          percent: 36,
          step: "prepare_db",
          message: `准备写入：新增 ${toInsert.length} 行，更新 ${toUpdate.length} 行，跳过 ${skipped} 行（模式：${importMode}）`,
        });

        /**
         * 大批量导入若包在单个 interactive transaction 内，易超过 Prisma/MySQL/代理
         * 的事务时长上限（P2028 Transaction not found）。改为：先建批次，再分块
         * createMany / update（每批独立提交）。
         */
        const batch = await prisma.enterpriseImportBatch.create({
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
          message: `已创建导入批次 #${batch.id}`,
        });

        const withBatch = toInsert.map((r) => ({
          ...r,
          batchId: batch.id,
        }));

        const parts = chunk(withBatch, CREATE_CHUNK);
        const totalParts = parts.length;
        const updateParts = chunk(toUpdate, UPDATE_CHUNK);
        const totalSteps = Math.max(1, totalParts + updateParts.length);
        let stepIdx = 0;

        for (let i = 0; i < totalParts; i++) {
          await prisma.enterpriseRecord.createMany({ data: parts[i] });
          stepIdx += 1;
          push({
            type: "progress",
            percent: Math.min(94, 40 + Math.round((stepIdx / totalSteps) * 54)),
            step: "insert",
            message: `插入：第 ${i + 1} / ${totalParts} 批`,
            currentChunk: i + 1,
            totalChunks: totalParts,
          });
        }

        for (let i = 0; i < updateParts.length; i++) {
          const group = updateParts[i];
          await Promise.all(
            group.map(({ id, data }) => {
              const { sheetKind, rowIndex, ...rest } = data;
              return prisma.enterpriseRecord.update({
                where: { id },
                data: {
                  ...rest,
                  batchId: batch.id,
                  sheetKind,
                  rowIndex,
                },
              });
            })
          );
          stepIdx += 1;
          push({
            type: "progress",
            percent: Math.min(97, 40 + Math.round((stepIdx / totalSteps) * 54)),
            step: "insert",
            message: `覆盖更新已存在企业：第 ${i + 1} / ${updateParts.length} 批`,
            currentChunk: i + 1,
            totalChunks: updateParts.length,
          });
        }

        push({
          type: "done",
          batch: {
            id: batch.id,
            fileName: batch.fileName,
            sheetNames: parsed.sheetNames,
            rowCountYilei,
            rowCountFeichanggui,
            rowCountJieliebang,
            totalRows: dedupedRows.length,
          },
          stats: {
            importMode,
            insertedRows: toInsert.length,
            updatedRows: toUpdate.length,
            skippedRows: skipped,
            internalDedupeDropped: internalDropped,
            parsedRawRows: allRows.length,
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
