import { EnterpriseSheetKind, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { normalizeHeader, resolveHeaderToField } from "./enterprise-headers";
import {
  parseBool,
  parseDate,
  parseDecimal,
  parseIntCell,
  parseString,
} from "./enterprise-parse";

const DATE_FIELDS = new Set<string>([
  "issueTime",
  "provideTime",
  "lastCreditSuccessTime",
  "lockPeriodEnd",
  "firstContactTime",
  "firstConnectTime",
  "latestContactTime",
  "latestConnectTime",
  "lastVisitTime",
  "scheduledVisitTime",
  "actualVisitTime",
  "registerTime",
]);

/** 与导入解析一致；差异对比时对布尔字段做语义归一（见 enterprise-import-dedupe） */
export const BOOL_FIELDS = new Set<string>([
  "isMgmCustomer",
  "discountCouponAvailable",
  "defaultRateOver9",
  "hasCustomerIntent",
  "actuallyVisited",
  "metCustomer",
  "listReturned",
  "suspectedRisk",
  "addressVerified",
  "addressMatchRegistered",
]);

const DECIMAL_FIELDS = new Set<string>([
  "quotaAmount",
  "bestPackagePrice",
  "referencePrice",
  "bankHistoricalPrice",
]);

const INT_FIELDS = new Set<string>(["contactCount", "todayRegisterCount", "silentDays"]);

function setField(
  target: Record<string, unknown>,
  field: string,
  raw: unknown
): void {
  if (DATE_FIELDS.has(field)) {
    target[field] = parseDate(raw);
    return;
  }
  if (BOOL_FIELDS.has(field)) {
    target[field] = parseBool(raw);
    return;
  }
  if (DECIMAL_FIELDS.has(field)) {
    target[field] = parseDecimal(raw);
    return;
  }
  if (INT_FIELDS.has(field)) {
    target[field] = parseIntCell(raw);
    return;
  }
  target[field] = parseString(raw);
}

function rowHasData(row: Record<string, unknown>): boolean {
  return Object.values(row).some((v) => {
    if (v == null) return false;
    if (typeof v === "string" && !v.trim()) return false;
    return true;
  });
}

function extraValue(v: unknown): string | number | boolean | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v;
  return String(v).trim();
}

export type ParsedEnterpriseRow = Omit<
  Prisma.EnterpriseRecordCreateManyInput,
  "batchId"
>;

function mapJsonRow(
  rawRow: Record<string, unknown>,
  sheetKind: EnterpriseSheetKind,
  rowIndex: number
): ParsedEnterpriseRow | null {
  if (!rowHasData(rawRow)) return null;

  const out: Record<string, unknown> = {
    sheetKind,
    rowIndex,
  };

  const extra: Record<string, string | number | boolean | null> = {};

  for (const [headerKey, cell] of Object.entries(rawRow)) {
    const nk = normalizeHeader(headerKey);
    if (!nk) continue;
    const field = resolveHeaderToField(headerKey);
    if (field) {
      setField(out, field, cell);
    } else {
      const ev = extraValue(cell);
      if (ev !== null) {
        extra[nk] = ev;
      }
    }
  }

  if (Object.keys(extra).length > 0) {
    out.extraJson = extra as Prisma.InputJsonValue;
  }

  return out as ParsedEnterpriseRow;
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  sheetKind: EnterpriseSheetKind
): ParsedEnterpriseRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
    blankrows: false,
  });

  const result: ParsedEnterpriseRow[] = [];
  rows.forEach((rawRow, i) => {
    const mapped = mapJsonRow(rawRow, sheetKind, i);
    if (mapped) result.push(mapped);
  });
  return result;
}

export const SHEET_ORDER: EnterpriseSheetKind[] = [
  EnterpriseSheetKind.YILEI,
  EnterpriseSheetKind.FEICHANGGUI,
  EnterpriseSheetKind.JIELIEBANG,
];

export type ParseSheetProgress = {
  sheetIndex: number;
  sheetName: string;
  kindLabel: string;
  rowCount: number;
};

const SHEET_KIND_LABEL: Record<EnterpriseSheetKind, string> = {
  YILEI: "一类",
  FEICHANGGUI: "非常规名单",
  JIELIEBANG: "接力棒",
};

/**
 * 解析工作簿；可选 onSheetParsed 在每表解析完成后回调（用于导入进度）
 */
export function parseEnterpriseWorkbook(
  buffer: Buffer,
  onSheetParsed?: (p: ParseSheetProgress) => void
): {
  rowsBySheet: ParsedEnterpriseRow[][];
  sheetNames: string[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const names = workbook.SheetNames;
  if (names.length < 3) {
    throw new Error(`Excel 须包含 3 个工作表，当前为 ${names.length} 个`);
  }

  const rowsBySheet: ParsedEnterpriseRow[][] = [];
  for (let i = 0; i < 3; i++) {
    const sheet = workbook.Sheets[names[i]];
    if (!sheet) {
      throw new Error(`工作表 ${i + 1} 不存在`);
    }
    const kind = SHEET_ORDER[i];
    const rows = parseSheet(sheet, kind);
    rowsBySheet.push(rows);
    onSheetParsed?.({
      sheetIndex: i,
      sheetName: names[i],
      kindLabel: SHEET_KIND_LABEL[kind],
      rowCount: rows.length,
    });
  }

  return { rowsBySheet, sheetNames: names.slice(0, 3) };
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
