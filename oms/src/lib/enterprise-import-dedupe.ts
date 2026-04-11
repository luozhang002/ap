import type { EnterpriseRecord, Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import {
  BOOL_FIELDS,
  parseEnterpriseWorkbook,
  type ParsedEnterpriseRow,
} from "./enterprise-import";

/** 企业名称：去首尾空白、合并空白，与 Excel「客户名称」列对应 */
export function normalizeCustomerKey(
  name: string | null | undefined
): string | null {
  if (name == null) return null;
  const t = String(name)
    .replace(/[\u3000\u00a0\t\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > 0 ? t : null;
}

export type ImportMode = "insert_all" | "skip_existing" | "upsert";

const DIFF_EXCLUDE = new Set([
  "id",
  "batchId",
  "rowIndex",
  "batch",
]);

function serializeCell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "object" && v !== null && "toFixed" in v) {
    return String((v as { toString: () => string }).toString());
  }
  if (typeof v === "boolean") return v ? "是" : "否";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/**
 * 布尔字段在库中可能是 tinyint 0/1（如 $queryRaw），导入侧为 boolean 或「是/否」；
 * 统一成「是」「否」或空再比较，避免「0」与「否」被误判为差异。
 */
function serializeBoolForDiff(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "是" : "否";
  if (typeof v === "number") {
    if (v === 0) return "否";
    if (v === 1) return "是";
  }
  if (typeof v === "bigint") {
    if (v === BigInt(0)) return "否";
    if (v === BigInt(1)) return "是";
  }
  const s = String(v).trim().toLowerCase();
  if (["0", "否", "n", "no", "false"].includes(s)) return "否";
  if (["1", "是", "y", "yes", "true", "√", "✓"].includes(s)) return "是";
  return String(v);
}

function serializeForDiff(field: string, v: unknown): string {
  if (BOOL_FIELDS.has(field)) {
    return serializeBoolForDiff(v);
  }
  return serializeCell(v);
}

export const FIELD_LABEL_ZH: Record<string, string> = {
  sheetKind: "类别",
  issueTime: "下发时间",
  provideTime: "提供时间",
  province: "所在省",
  city: "所在市",
  district: "所在区",
  street: "所在街道",
  ccif: "ccif",
  customerName: "客户名称",
  issuedAddress: "下发地址",
  addressVerifyLabel: "地址核验标签",
  industry: "行业",
  addressVerified: "是否完成地址核验",
  actualBusinessAddress: "实际经营地址",
  quotaAmount: "额度",
  bestPackagePrice: "当前最优套餐价格",
  newOrExistingCustomer: "新/存 客",
  customerLevel: "客户级别",
  lastCreditSuccessTime: "最近一次授信成功时间",
  lockPeriodEnd: "锁期时间",
  repaymentMethod: "当前套餐还款方式",
  referencePrice: "参考价",
  bankHistoricalPrice: "我行历史参考价",
  discountCouponAvailable: "是否可用折扣券",
  defaultRateOver9: "预计金额违约率是否大于9",
  ownerName: "客户经理",
  branchOwnerName: "分中心负责人",
  legalPersonName: "法人姓名",
  contactPhone: "联系电话",
  firstContactTime: "首次联系时间",
  firstConnectTime: "首次接通时间",
  latestContactTime: "最新一次联系时间",
  latestConnectTime: "最新一次接通时间",
  lastVisitTime: "最近一次上门时间",
  contactCount: "联系次数",
  hasCustomerIntent: "确认客户是否有意愿",
  unreachableReason: "未触达原因",
  scheduledVisitTime: "预约上门时间",
  visitRemark: "联系/走访情况备注",
  labelTag: "label",
  actuallyVisited: "是否实际上门",
  actualVisitTime: "实际上门时间",
  metCustomer: "是否见到客户",
  listReturned: "名单是否退回",
  returnReason: "退回原因",
  channel: "渠道",
  imageMaterials: "影像资料",
  registerTime: "登记时间",
  telemarketingNote: "电销备注",
  relayTag: "接力棒标签",
  isMgmCustomer: "是否为MGM客户",
  suspectedRisk: "是否疑似风险客户",
  todayRegisterCount: "今天登记次数",
  listType: "名单类型",
  silentDays: "沉默天数",
  packageName: "套餐",
  addressMatchRegistered: "实际经营地址是否和注册地址一致",
  customerType: "客户类型",
  extraJson: "扩展字段(extraJson)",
};

const SHEET_LABEL: Record<string, string> = {
  YILEI: "一类",
  FEICHANGGUI: "非常规名单",
  JIELIEBANG: "接力棒",
};

/** 文件内同名多行时，非「最后一行」被合并掉的一条记录 */
export type InternalDedupeDroppedDetail = {
  normalizedKey: string;
  /** Excel 原文（便于与表对照） */
  customerNameDisplay: string;
  sheetKind: string;
  sheetKindLabel: string;
  /** 0-based，与解析一致；展示为「第 n 行」时用 rowIndex + 1 */
  rowIndex: number;
  keptSheetKind: string;
  keptSheetKindLabel: string;
  keptRowIndex: number;
};

export function diffRowVsExisting(
  incoming: ParsedEnterpriseRow,
  existing: EnterpriseRecord
): Array<{
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}> {
  const out: Array<{
    field: string;
    label: string;
    oldValue: string;
    newValue: string;
  }> = [];
  const keys = new Set([
    ...Object.keys(incoming),
    ...Object.keys(existing),
  ] as string[]);
  for (const key of keys) {
    if (DIFF_EXCLUDE.has(key)) continue;
    const a = (incoming as Record<string, unknown>)[key];
    const b = (existing as Record<string, unknown>)[key];
    const sa = serializeForDiff(key, a);
    const sb = serializeForDiff(key, b);
    if (sa === sb) continue;
    out.push({
      field: key,
      label: FIELD_LABEL_ZH[key] ?? key,
      oldValue: sb,
      newValue: sa,
    });
  }
  return out;
}

export function dedupeWithinFileLastWins(allRows: ParsedEnterpriseRow[]): {
  rows: ParsedEnterpriseRow[];
  internalDropped: number;
  droppedDetails: InternalDedupeDroppedDetail[];
} {
  const lastWin = new Map<string, ParsedEnterpriseRow>();
  for (const r of allRows) {
    const k = normalizeCustomerKey(r.customerName);
    if (!k) continue;
    lastWin.set(k, r);
  }
  const deduped: ParsedEnterpriseRow[] = [];
  const droppedDetails: InternalDedupeDroppedDetail[] = [];
  for (const r of allRows) {
    const k = normalizeCustomerKey(r.customerName);
    if (!k) {
      deduped.push(r);
      continue;
    }
    const winner = lastWin.get(k)!;
    if (winner !== r) {
      droppedDetails.push({
        normalizedKey: k,
        customerNameDisplay:
          r.customerName != null ? String(r.customerName).trim() : "",
        sheetKind: r.sheetKind,
        sheetKindLabel: SHEET_LABEL[r.sheetKind] ?? r.sheetKind,
        rowIndex: r.rowIndex,
        keptSheetKind: winner.sheetKind,
        keptSheetKindLabel: SHEET_LABEL[winner.sheetKind] ?? winner.sheetKind,
        keptRowIndex: winner.rowIndex,
      });
      continue;
    }
    deduped.push(r);
  }
  return {
    rows: deduped,
    internalDropped: droppedDetails.length,
    droppedDetails,
  };
}

const QUERY_CHUNK = 80;

export async function loadExistingByCustomerKeys(
  prisma: Prisma.TransactionClient | import("@prisma/client").PrismaClient,
  normalizedKeys: string[]
): Promise<Map<string, EnterpriseRecord>> {
  const map = new Map<string, EnterpriseRecord>();
  const uniq = [...new Set(normalizedKeys)].filter(Boolean);
  if (uniq.length === 0) return map;

  for (let i = 0; i < uniq.length; i += QUERY_CHUNK) {
    const part = uniq.slice(i, i + QUERY_CHUNK);
    const inList = PrismaRuntime.join(part.map((k) => PrismaRuntime.sql`${k}`));
    const rows = await prisma.$queryRaw<EnterpriseRecord[]>(
      PrismaRuntime.sql`
        SELECT * FROM enterprise_records
        WHERE TRIM(customerName) IN (${inList})
      `
    );
    for (const row of rows) {
      const nk = normalizeCustomerKey(row.customerName);
      if (!nk) continue;
      const prev = map.get(nk);
      if (!prev || row.id > prev.id) {
        map.set(nk, row);
      }
    }
  }
  return map;
}

export type ProcessRowsResult = {
  toInsert: ParsedEnterpriseRow[];
  toUpdate: Array<{ id: number; data: ParsedEnterpriseRow }>;
  skipped: number;
};

export function partitionByImportMode(
  dedupedRows: ParsedEnterpriseRow[],
  existingByKey: Map<string, EnterpriseRecord>,
  mode: ImportMode
): ProcessRowsResult {
  const toInsert: ParsedEnterpriseRow[] = [];
  const toUpdate: Array<{ id: number; data: ParsedEnterpriseRow }> = [];
  let skipped = 0;

  if (mode === "insert_all") {
    return { toInsert: dedupedRows, toUpdate: [], skipped: 0 };
  }

  for (const row of dedupedRows) {
    const k = normalizeCustomerKey(row.customerName);
    if (!k) {
      toInsert.push(row);
      continue;
    }
    const ex = existingByKey.get(k);
    if (!ex) {
      toInsert.push(row);
      continue;
    }
    if (mode === "skip_existing") {
      skipped += 1;
      continue;
    }
    if (mode === "upsert") {
      toUpdate.push({ id: ex.id, data: row });
    }
  }

  return { toInsert, toUpdate, skipped };
}

export type DuplicateSample = {
  normalizedKey: string;
  sheetKind: string;
  sheetKindLabel: string;
  rowIndex: number;
  existing: {
    id: number;
    batchId: number;
    sheetKind: string;
    sheetKindLabel: string;
  };
  diffFields: Array<{
    field: string;
    label: string;
    oldValue: string;
    newValue: string;
  }>;
};

export type AnalyzeImportResult = {
  fileName: string;
  sheetNames: string[];
  totalParsedRows: number;
  internalDedupeDropped: number;
  /** 文件内被合并掉的行（同名保留最后一行） */
  internalDedupeDetails: InternalDedupeDroppedDetail[];
  rowsAfterInternalDedupe: number;
  duplicateVsDbCount: number;
  /** 与库重名且存在可比对字段差异的行数（用于判断「是否全部为无差异重复」） */
  duplicateVsDbWithDiffCount: number;
  newRowCount: number;
  duplicateSamples: DuplicateSample[];
  duplicateSamplesTruncated: boolean;
};

const MAX_SAMPLES = 40;
const MAX_DIFF_FIELDS_PER_ROW = 18;

export async function analyzeEnterpriseImport(
  prisma: import("@prisma/client").PrismaClient,
  buffer: Buffer,
  fileName: string
): Promise<AnalyzeImportResult> {
  const parsed = parseEnterpriseWorkbook(buffer);
  const sheetNames = parsed.sheetNames;
  const allRows = [
    ...parsed.rowsBySheet[0],
    ...parsed.rowsBySheet[1],
    ...parsed.rowsBySheet[2],
  ];
  const {
    rows: deduped,
    internalDropped,
    droppedDetails: internalDedupeDetails,
  } = dedupeWithinFileLastWins(allRows);
  const keys = deduped
    .map((r) => normalizeCustomerKey(r.customerName))
    .filter((k): k is string => k != null);

  const existingByKey = await loadExistingByCustomerKeys(prisma, keys);

  let duplicateVsDbCount = 0;
  let duplicateVsDbWithDiffCount = 0;
  const duplicateSamples: DuplicateSample[] = [];

  for (const row of deduped) {
    const k = normalizeCustomerKey(row.customerName);
    if (!k) continue;
    const ex = existingByKey.get(k);
    if (!ex) continue;
    duplicateVsDbCount += 1;
    const diffs = diffRowVsExisting(row, ex);
    if (diffs.length > 0) duplicateVsDbWithDiffCount += 1;
    if (duplicateSamples.length >= MAX_SAMPLES) continue;
    duplicateSamples.push({
      normalizedKey: k,
      sheetKind: row.sheetKind,
      sheetKindLabel: SHEET_LABEL[row.sheetKind] ?? row.sheetKind,
      rowIndex: row.rowIndex,
      existing: {
        id: ex.id,
        batchId: ex.batchId,
        sheetKind: ex.sheetKind,
        sheetKindLabel: SHEET_LABEL[ex.sheetKind] ?? ex.sheetKind,
      },
      diffFields: diffs.slice(0, MAX_DIFF_FIELDS_PER_ROW),
    });
  }

  let newRowCount = 0;
  for (const row of deduped) {
    const k = normalizeCustomerKey(row.customerName);
    if (!k) {
      newRowCount += 1;
      continue;
    }
    if (!existingByKey.has(k)) newRowCount += 1;
  }

  return {
    fileName,
    sheetNames,
    totalParsedRows: allRows.length,
    internalDedupeDropped: internalDropped,
    internalDedupeDetails,
    rowsAfterInternalDedupe: deduped.length,
    duplicateVsDbCount,
    duplicateVsDbWithDiffCount,
    newRowCount,
    duplicateSamples,
    duplicateSamplesTruncated: duplicateVsDbCount > MAX_SAMPLES,
  };
}
