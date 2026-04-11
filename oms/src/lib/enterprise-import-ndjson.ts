/** 导入接口流式返回的 NDJSON 行类型（与 /api/enterprises/import 一致） */
export type EnterpriseImportStreamEvent =
  | {
      type: "progress";
      percent: number;
      step: string;
      message: string;
      sheetIndex?: number;
      rowCount?: number;
      currentChunk?: number;
      totalChunks?: number;
    }
  | {
      type: "done";
      batch: {
        id: number;
        fileName: string;
        sheetNames: string[];
        rowCountYilei: number;
        rowCountFeichanggui: number;
        rowCountJieliebang: number;
        totalRows: number;
      };
      stats?: {
        importMode: string;
        insertedRows: number;
        updatedRows: number;
        skippedRows: number;
        internalDedupeDropped: number;
        parsedRawRows: number;
      };
    }
  | { type: "error"; message: string };

export async function readNdjsonLines(
  body: ReadableStream<Uint8Array> | null,
  onLine: (obj: EnterpriseImportStreamEvent) => void,
  /** 与 fetch 共用同一 AbortController，取消时主动 reader.cancel()，避免长时间卡在 read() */
  signal?: AbortSignal
): Promise<void> {
  if (!body) return;
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  const onAbort = () => {
    reader.cancel().catch(() => undefined);
  };
  if (signal) {
    if (signal.aborted) {
      onAbort();
      throw new DOMException("Aborted", "AbortError");
    }
    signal.addEventListener("abort", onAbort);
  }

  try {
  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        onLine(JSON.parse(line) as EnterpriseImportStreamEvent);
      } catch {
        /* 忽略损坏行 */
      }
    }
  }
  const rest = buf.trim();
  if (rest) {
    try {
      onLine(JSON.parse(rest) as EnterpriseImportStreamEvent);
    } catch {
      /* ignore */
    }
  }
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}
