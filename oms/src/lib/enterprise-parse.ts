import { Prisma } from "@prisma/client";

/** Excel 日期序列 → Date（含小数表示当天时刻） */
export function excelSerialToDate(serial: number): Date | null {
  if (typeof serial !== "number" || !Number.isFinite(serial)) return null;
  if (serial <= 0) return null;
  const whole = Math.floor(serial);
  const frac = serial - whole;
  const epoch = new Date(1899, 11, 30);
  const ms = epoch.getTime() + whole * 86400000 + Math.round(frac * 86400000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === "number") {
    if (v > 20000 && v < 60000) {
      return excelSerialToDate(v);
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const day = Number(m[3]);
    const t = new Date(y, mo, day);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  return null;
}

export function parseBool(v: unknown): boolean | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (["是", "y", "yes", "true", "1", "√", "✓"].includes(s)) return true;
  if (["否", "n", "no", "false", "0"].includes(s)) return false;
  return null;
}

export function parseDecimal(v: unknown): Prisma.Decimal | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Prisma.Decimal(v);
  }
  const s = String(v).trim().replace(/,/g, "").replace(/%/g, "");
  if (!s || s === "-" || s === "—") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(n);
}

export function parseIntCell(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const s = String(v).trim().replace(/,/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
