"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type EnterpriseImportStreamEvent,
  readNdjsonLines,
} from "@/lib/enterprise-import-ndjson";

/** 与 NDJSON `type: "done"` 的 `batch` 一致，避免部分 TS 版本将 `doneBatches.at(-1)` 推断为 `never` */
type ImportDoneBatch = Extract<
  EnterpriseImportStreamEvent,
  { type: "done" }
>["batch"];
import { parseJsonBody } from "@/lib/fetch-json";
import styles from "./EnterprisesManagement.module.css";

const SHEET_LABELS: Record<string, string> = {
  YILEI: "一类",
  FEICHANGGUI: "非常规名单",
  JIELIEBANG: "接力棒",
};

type BatchRow = {
  id: number;
  fileName: string;
  createdAt: string;
  rowCountYilei: number;
  rowCountFeichanggui: number;
  rowCountJieliebang: number;
};

type RecordRow = {
  id: number;
  sheetKind: string;
  rowIndex: number;
  issueTime: string | null;
  provideTime: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  ccif: string | null;
  customerName: string | null;
  issuedAddress: string | null;
  addressVerifyLabel: string | null;
  industry: string | null;
  quotaAmount: string | null;
  bestPackagePrice: string | null;
  newOrExistingCustomer: string | null;
  customerLevel: string | null;
  isMgmCustomer: boolean | null;
  ownerName: string | null;
  branchOwnerName: string | null;
  contactPhone: string | null;
  channel: string | null;
  relayTag: string | null;
  telemarketingNote?: string | null;
  lastVisitTime: string | null;
  scheduledVisitTime: string | null;
  actuallyVisited: boolean | null;
  actualVisitTime: string | null;
  metCustomer: boolean | null;
  listReturned: boolean | null;
  returnReason: string | null;
  visitRemark: string | null;
  extraJson: unknown;
  batch: { id: number; fileName: string; createdAt: string };
};

type Toast = { type: "success" | "error"; text: string };

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("zh-CN");
}

function fmtBool(v: boolean | null): string {
  if (v === null || v === undefined) return "—";
  return v ? "是" : "否";
}

function escapeCsvCell(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

const IMPORT_STEP_LABEL: Record<string, string> = {
  init: "初始化",
  receive: "接收文件",
  read: "读取文件",
  parse_sheet: "解析工作表",
  prepare_db: "准备入库",
  batch_created: "创建批次",
  insert: "写入数据库",
};

type ImportAnalyzeResponse = {
  fileName: string;
  sheetNames: string[];
  totalParsedRows: number;
  internalDedupeDropped: number;
  internalDedupeDetails?: Array<{
    normalizedKey: string;
    customerNameDisplay: string;
    sheetKind: string;
    sheetKindLabel: string;
    rowIndex: number;
    keptSheetKind: string;
    keptSheetKindLabel: string;
    keptRowIndex: number;
  }>;
  rowsAfterInternalDedupe: number;
  duplicateVsDbCount: number;
  newRowCount: number;
  duplicateSamples: Array<{
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
  }>;
  duplicateSamplesTruncated: boolean;
  /** 与库重名且存在字段差异的行数；为 0 且 duplicateVsDbCount>0 表示重名行与库可比对字段全部一致 */
  duplicateVsDbWithDiffCount?: number;
};

type ImportModeForm = "skip_existing" | "upsert";

type ImportDoneStats = {
  importMode: string;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  internalDedupeDropped: number;
  parsedRawRows: number;
};

/** 文件内同名合并明细（库冲突弹窗默认折叠；仅文件内重复弹窗默认展开） */
function ImportInternalDedupeDetails({
  data,
  defaultOpen = false,
}: {
  data: ImportAnalyzeResponse;
  defaultOpen?: boolean;
}) {
  const n = data.internalDedupeDropped ?? 0;
  if (n <= 0) return null;
  const rows = data.internalDedupeDetails ?? [];
  return (
    <details className={styles.importDedupeDetails} open={defaultOpen}>
      <summary className={styles.importDedupeSummary}>
        查看文件内同名合并明细（共 {n} 行被合并，以各名称下 <strong>最后一行</strong>为准）
      </summary>
      <div className={styles.importDedupeTableWrap}>
        <table className={styles.importDedupeTable}>
          <thead>
            <tr>
              <th>规范化名称（键）</th>
              <th>被合并行</th>
              <th>保留行（最后一行）</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={`${d.normalizedKey}-${d.sheetKind}-${d.rowIndex}-${i}`}>
                <td className={styles.importDiffCellKey}>
                  <span className={styles.importDedupeKey}>{d.normalizedKey}</span>
                  {d.customerNameDisplay && d.customerNameDisplay !== d.normalizedKey ? (
                    <span className={styles.muted}>
                      <br />
                      原文：{d.customerNameDisplay}
                    </span>
                  ) : null}
                </td>
                <td>
                  {d.sheetKindLabel} · 第 {d.rowIndex + 1} 行
                </td>
                <td>
                  {d.keptSheetKindLabel} · 第 {d.keptRowIndex + 1} 行
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function EnterprisesManagement() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const pendingImportFileRef = useRef<File | null>(null);

  const [importAnalyzing, setImportAnalyzing] = useState(false);
  const [importConflict, setImportConflict] = useState<ImportAnalyzeResponse | null>(null);
  /** 与库无重名，但文件内有同名行需合并时，先确认再导入 */
  const [importFileDedupePreview, setImportFileDedupePreview] =
    useState<ImportAnalyzeResponse | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    percent: number;
    message: string;
    step: string;
    chunkLabel?: string;
    indeterminate?: boolean;
  } | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  /** 主筛选：企业名称 */
  const [customerName, setCustomerName] = useState("");
  /** 客户经理 → 库字段 ownerName（CRM 登录姓名与此匹配） */
  const [ownerName, setOwnerName] = useState("");
  const [city, setCity] = useState("");
  /** 分中心负责人 → 库字段 branchOwnerName（上级管辖，非 CRM 匹配字段） */
  const [branchOwnerName, setBranchOwnerName] = useState("");

  const [sheetKind, setSheetKind] = useState("");
  const [batchId, setBatchId] = useState("");
  const [district, setDistrict] = useState("");
  const [issueFrom, setIssueFrom] = useState("");
  const [issueTo, setIssueTo] = useState("");

  const [editRow, setEditRow] = useState<RecordRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editDraft, setEditDraft] = useState({
    customerName: "",
    city: "",
    district: "",
    ccif: "",
    branchOwnerName: "",
    ownerName: "",
    contactPhone: "",
    channel: "",
    relayTag: "",
    telemarketingNote: "",
    listReturned: "" as "" | "true" | "false",
    returnReason: "",
  });

  const showError = (text: string) => setToast({ type: "error", text });
  const showSuccess = (text: string) => setToast({ type: "success", text });

  /** 与库重名且可比对字段全部一致（无需也不建议覆盖更新） */
  const importConflictDupAllIdenticalToDb = useMemo(() => {
    if (!importConflict) return false;
    const withDiff = importConflict.duplicateVsDbWithDiffCount;
    if (withDiff === undefined) return false;
    return importConflict.duplicateVsDbCount > 0 && withDiff === 0;
  }, [importConflict]);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.type === "success" ? 3200 : 6500;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast]);

  const loadBatches = useCallback(async () => {
    const res = await fetch("/api/enterprises/batches");
    const data = await parseJsonBody<{ batches?: BatchRow[]; error?: string }>(res);
    if (!res.ok) {
      showError(typeof data.error === "string" ? data.error : "加载批次失败");
      return;
    }
    setBatches(data.batches ?? []);
  }, []);

  const fetchRecordsForPage = useCallback(
    async (pageNum: number, opts?: { batchIdOverride?: string }) => {
      setLoading(true);
      try {
        const bid = opts?.batchIdOverride ?? batchId;
        const p = new URLSearchParams();
        p.set("page", String(pageNum));
        p.set("pageSize", String(pageSize));
        if (sheetKind) p.set("sheetKind", sheetKind);
        if (bid) p.set("batchId", bid);
        if (customerName.trim()) p.set("customerName", customerName.trim());
        if (ownerName.trim()) p.set("ownerName", ownerName.trim());
        if (city.trim()) p.set("city", city.trim());
        if (district.trim()) p.set("district", district.trim());
        if (branchOwnerName.trim()) p.set("branchOwnerName", branchOwnerName.trim());
        if (issueFrom) p.set("issueFrom", issueFrom);
        if (issueTo) p.set("issueTo", issueTo);

        const res = await fetch(`/api/enterprises/records?${p.toString()}`);
        const data = await parseJsonBody<{
          records?: RecordRow[];
          total?: number;
          error?: string;
        }>(res);
        if (!res.ok) {
          showError(typeof data.error === "string" ? data.error : "加载列表失败");
          return;
        }
        setRecords(data.records ?? []);
        setTotal(data.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [
      sheetKind,
      batchId,
      customerName,
      ownerName,
      city,
      district,
      branchOwnerName,
      issueFrom,
      issueTo,
    ]
  );

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    void fetchRecordsForPage(page);
  }, [page, fetchRecordsForPage]);

  const applySearch = () => {
    if (page === 1) void fetchRecordsForPage(1);
    else setPage(1);
  };

  const refreshList = () => {
    void loadBatches();
    void fetchRecordsForPage(page);
  };

  const openEdit = (r: RecordRow) => {
    setEditRow(r);
    setEditDraft({
      customerName: r.customerName ?? "",
      city: r.city ?? "",
      district: r.district ?? "",
      ccif: r.ccif ?? "",
      branchOwnerName: r.branchOwnerName ?? "",
      ownerName: r.ownerName ?? "",
      contactPhone: r.contactPhone ?? "",
      channel: r.channel ?? "",
      relayTag: r.relayTag ?? "",
      telemarketingNote: r.telemarketingNote ?? "",
      listReturned:
        r.listReturned === true ? "true" : r.listReturned === false ? "false" : "",
      returnReason: r.returnReason ?? "",
    });
  };

  const closeEdit = () => {
    setEditRow(null);
    setEditSaving(false);
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/enterprises/records/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: editDraft.customerName,
          city: editDraft.city,
          district: editDraft.district,
          ccif: editDraft.ccif,
          branchOwnerName: editDraft.branchOwnerName,
          ownerName: editDraft.ownerName,
          contactPhone: editDraft.contactPhone,
          channel: editDraft.channel,
          relayTag: editDraft.relayTag,
          telemarketingNote: editDraft.telemarketingNote,
          listReturned:
            editDraft.listReturned === ""
              ? null
              : editDraft.listReturned === "true",
          returnReason: editDraft.returnReason,
        }),
      });
      const data = await parseJsonBody<{ error?: string }>(res);
      if (!res.ok) {
        showError(typeof data.error === "string" ? data.error : "保存失败");
        return;
      }
      showSuccess("已保存");
      closeEdit();
      void fetchRecordsForPage(page);
    } finally {
      setEditSaving(false);
    }
  };

  const deleteRow = async (r: RecordRow) => {
    const name = r.customerName?.trim() || `记录 #${r.id}`;
    if (!window.confirm(`确定删除「${name}」？此操作不可恢复。`)) return;
    const res = await fetch(`/api/enterprises/records/${r.id}`, { method: "DELETE" });
    const data = await parseJsonBody<{ error?: string }>(res);
    if (!res.ok) {
      showError(typeof data.error === "string" ? data.error : "删除失败");
      return;
    }
    showSuccess("已删除");
    if (editRow?.id === r.id) closeEdit();
    void fetchRecordsForPage(page);
    void loadBatches();
  };

  const runImportWithMode = async (file: File, importMode: ImportModeForm) => {
    importAbortRef.current?.abort();
    const ac = new AbortController();
    importAbortRef.current = ac;

    setImporting(true);
    setImportProgress({
      percent: 0,
      message: "连接服务器…",
      step: "init",
      indeterminate: false,
    });

    let streamError: string | null = null;
    const doneBatches: ImportDoneBatch[] = [];
    let lastStats: ImportDoneStats | null = null;

    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("importMode", importMode);
      const res = await fetch("/api/enterprises/import", {
        method: "POST",
        body: fd,
        signal: ac.signal,
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        if (ct.includes("application/json")) {
          const data = await parseJsonBody<{ error?: string }>(res);
          showError(typeof data.error === "string" ? data.error : "导入失败");
        } else {
          showError(`导入失败（HTTP ${res.status}）`);
        }
        return;
      }

      await readNdjsonLines(
        res.body,
        (ev: EnterpriseImportStreamEvent) => {
          if (ev.type === "progress") {
            setImportProgress({
              percent: Math.min(100, Math.max(0, Math.round(ev.percent))),
              message: ev.message,
              step: ev.step,
              indeterminate: false,
              chunkLabel:
                ev.currentChunk != null && ev.totalChunks != null
                  ? `第 ${ev.currentChunk} / ${ev.totalChunks} 批`
                  : undefined,
            });
          } else if (ev.type === "error") {
            streamError = ev.message;
          } else if (ev.type === "done") {
            doneBatches.push(ev.batch);
            if (ev.stats) lastStats = ev.stats as ImportDoneStats;
          }
        },
        ac.signal
      );

      if (streamError) {
        showError(streamError);
        return;
      }
      const doneBatch =
        doneBatches.length > 0
          ? doneBatches[doneBatches.length - 1]
          : undefined;
      if (doneBatch) {
        const s = lastStats as ImportDoneStats | null;
        const statLine = s
          ? `${s.insertedRows} 行新增，${s.updatedRows} 行覆盖更新，${s.skippedRows} 行跳过${
              s.internalDedupeDropped > 0
                ? `（文件内已合并重复 ${s.internalDedupeDropped} 行）`
                : ""
            }；`
          : "";
        showSuccess(
          `${statLine}本批次共 ${doneBatch.totalRows} 行（一类 ${doneBatch.rowCountYilei} / 非常规 ${doneBatch.rowCountFeichanggui} / 接力棒 ${doneBatch.rowCountJieliebang}）`
        );
        /** 勿自动筛选到新批次：否则列表请求带 batchId，只能看到本批（如 1 条），历史批次数据被隐藏，易误以为丢失 */
        setBatchId("");
        setPage(1);
        await loadBatches();
        await fetchRecordsForPage(1, { batchIdOverride: "" });
      }
    } catch (e) {
      const aborted =
        e instanceof DOMException
          ? e.name === "AbortError"
          : e instanceof Error && e.name === "AbortError";
      if (aborted) {
        showError("已取消导入");
      } else {
        showError(e instanceof Error ? e.message : "导入失败");
      }
    } finally {
      setImporting(false);
      setImportProgress(null);
      importAbortRef.current = null;
    }
  };

  const submitImport = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    importAbortRef.current?.abort();
    const ac = new AbortController();
    importAbortRef.current = ac;

    pendingImportFileRef.current = file;
    setImportAnalyzing(true);
    setImportProgress({
      percent: 0,
      message:
        "① 解析 Excel ② 查询库内是否已有同名企业 ③ 比对字段差异。十万行级可能需数分钟。",
      step: "prepare_db",
      indeterminate: true,
    });

    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/enterprises/import/analyze", {
        method: "POST",
        body: fd,
        signal: ac.signal,
      });
      const data = await parseJsonBody<ImportAnalyzeResponse & { error?: string }>(res);
      if (!res.ok) {
        showError(typeof data.error === "string" ? data.error : "分析失败");
        return;
      }

      if (data.duplicateVsDbCount > 0) {
        setImportConflict(data);
        return;
      }

      const fileDedupe = data.internalDedupeDropped ?? 0;
      if (fileDedupe > 0) {
        setImportFileDedupePreview(data);
        return;
      }

      setImportAnalyzing(false);
      setImportProgress(null);
      await runImportWithMode(file, "skip_existing");
    } catch (e) {
      const aborted =
        e instanceof DOMException
          ? e.name === "AbortError"
          : e instanceof Error && e.name === "AbortError";
      if (aborted) {
        showError("已取消分析");
      } else {
        showError(e instanceof Error ? e.message : "分析失败");
      }
    } finally {
      setImportAnalyzing(false);
      setImportProgress(null);
      if (importAbortRef.current === ac) importAbortRef.current = null;
    }
  };

  const closeImportConflict = () => {
    setImportConflict(null);
    pendingImportFileRef.current = null;
  };

  const closeImportFileDedupe = () => {
    setImportFileDedupePreview(null);
    pendingImportFileRef.current = null;
  };

  const confirmImportWithMode = async (mode: ImportModeForm) => {
    const file = pendingImportFileRef.current;
    if (!file) return;
    setImportConflict(null);
    await runImportWithMode(file, mode);
    pendingImportFileRef.current = null;
  };

  const confirmFileDedupeImport = async () => {
    const file = pendingImportFileRef.current;
    if (!file) return;
    setImportFileDedupePreview(null);
    await runImportWithMode(file, "skip_existing");
    pendingImportFileRef.current = null;
  };

  const resetFilters = () => {
    setCustomerName("");
    setOwnerName("");
    setCity("");
    setBranchOwnerName("");
    setSheetKind("");
    setBatchId("");
    setDistrict("");
    setIssueFrom("");
    setIssueTo("");
    setPage(1);
  };

  const exportCsv = () => {
    if (records.length === 0) {
      showError("当前没有可导出的数据");
      return;
    }
    const headers = [
      "类别",
      "企业名称",
      "下发地址",
      "所在省",
      "所在市",
      "所在区",
      "CCIF",
      "客户经理",
      "分中心负责人",
      "下发时间",
      "额度",
      "联系电话",
      "渠道",
      "接力棒标签",
      "是否实际上门",
      "是否见到客户",
      "名单是否退回",
      "退回原因",
      "最近一次上门时间",
      "预约上门时间",
      "实际上门时间",
      "联系/走访情况备注",
      "MGM",
      "导入批次",
    ];
    const lines = [
      headers.map(escapeCsvCell).join(","),
      ...records.map((r) =>
        [
          SHEET_LABELS[r.sheetKind] ?? r.sheetKind,
          r.customerName ?? "",
          r.issuedAddress ?? "",
          r.province ?? "",
          r.city ?? "",
          r.district ?? "",
          r.ccif ?? "",
          r.ownerName ?? "",
          r.branchOwnerName ?? "",
          r.issueTime ? fmtDate(r.issueTime) : "",
          r.quotaAmount ?? "",
          r.contactPhone ?? "",
          r.channel ?? "",
          r.relayTag ?? "",
          fmtBool(r.actuallyVisited),
          fmtBool(r.metCustomer),
          fmtBool(r.listReturned),
          r.returnReason ?? "",
          r.lastVisitTime ? fmtDate(r.lastVisitTime) : "",
          r.scheduledVisitTime ? fmtDate(r.scheduledVisitTime) : "",
          r.actualVisitTime ? fmtDate(r.actualVisitTime) : "",
          r.visitRemark ?? "",
          fmtBool(r.isMgmCustomer),
          r.batch ? `#${r.batch.id} ${r.batch.fileName}` : "",
        ]
          .map((c) => escapeCsvCell(String(c)))
          .join(",")
      ),
    ];
    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `企业管理_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess("已导出当前页数据为 CSV");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>企业管理</h1>
      </div>

      <p className={styles.hint}>
        Excel 须含 <strong>3 个工作表</strong>（顺序：一类 / 非常规名单 / 接力棒）。导入列<strong>「客户名称」</strong>即企业名称（与下表「企业名称」同一字段）；重复导入时先分析，<strong>推荐以本次 Excel 为准覆盖更新</strong>库中已有企业。文件内多行同名保留最后一行。
        主筛可按<strong>客户经理</strong>（导入列「负责人」）；更多筛选可按<strong>分中心负责人</strong>。
      </p>

      {toast?.type === "error" && <div className={styles.bannerError}>{toast.text}</div>}
      {toast?.type === "success" && <div className={styles.bannerSuccess}>{toast.text}</div>}

      <div className={styles.searchCard}>
        <div className={styles.searchRow}>
          <label className={styles.filterItem}>
            <span className={styles.filterLabel}>企业名称</span>
            <input
              className={styles.filterInput}
              placeholder="请输入企业名称"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
            />
          </label>
          <label className={styles.filterItem}>
            <span className={styles.filterLabel}>客户经理</span>
            <input
              className={styles.filterInput}
              placeholder="与导入「负责人」一致"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
            />
          </label>
          <label className={styles.filterItem}>
            <span className={styles.filterLabel}>所在市</span>
            <input
              className={styles.filterInput}
              placeholder="请输入所在市"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
            />
          </label>
          <label className={styles.filterItem}>
            <span className={styles.filterLabel}>类别</span>
            <select
              className={styles.filterInput}
              value={sheetKind}
              onChange={(e) => {
                setSheetKind(e.target.value);
                setPage(1);
              }}
            >
              <option value="">全部</option>
              <option value="YILEI">一类</option>
              <option value="FEICHANGGUI">非常规名单</option>
              <option value="JIELIEBANG">接力棒</option>
            </select>
          </label>
          <div className={styles.searchActions}>
            <button type="button" className={styles.btnSearch} onClick={applySearch}>
              <span className={styles.btnIcon} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.2-4.2" />
                </svg>
              </span>
              搜索
            </button>
            <button type="button" className={styles.btnReset} onClick={resetFilters}>
              <span className={styles.btnIcon} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12a8 8 0 1 1 2.4 5.7" />
                  <path d="M4 16v-4h4" />
                </svg>
              </span>
              重置
            </button>
          </div>
        </div>

        <div className={styles.actionRow}>
          <div className={styles.actionLeft}>
            <button
              type="button"
              className={styles.btnImport}
              disabled={importing || importAnalyzing}
              onClick={() => importInputRef.current?.click()}
            >
              {importAnalyzing ? "分析中…" : importing ? "导入中…" : "导入"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className={styles.hiddenFile}
              aria-label="上传 Excel 导入"
              disabled={importing || importAnalyzing}
              onChange={(e) => {
                void submitImport(e.target.files);
                e.target.value = "";
              }}
            />
            <button type="button" className={styles.btnExport} onClick={exportCsv}>
              导出
            </button>
          </div>
          <div className={styles.actionRight}>
            <button type="button" className={styles.iconRound} title="搜索" onClick={applySearch}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.2-4.2" />
              </svg>
            </button>
            <button type="button" className={styles.iconRound} title="刷新" onClick={refreshList}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12a8 8 0 1 1 2.4 5.7" />
                <path d="M4 16v-4h4" />
              </svg>
            </button>
          </div>
        </div>

        <details className={styles.moreBlock}>
          <summary className={styles.moreSummary}>更多筛选</summary>
          <div className={styles.moreGrid}>
            <label className={styles.filterItem}>
              <span className={styles.filterLabel}>分中心负责人</span>
              <input
                className={styles.filterInput}
                placeholder="请输入分中心负责人"
                value={branchOwnerName}
                onChange={(e) => setBranchOwnerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
              />
            </label>
            <label className={styles.filterItem}>
              <span className={styles.filterLabel}>导入批次</span>
              <select
                className={styles.filterInput}
                value={batchId}
                onChange={(e) => {
                  setBatchId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                {batches.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    #{b.id} {b.fileName}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.filterItem}>
              <span className={styles.filterLabel}>所在区</span>
              <input
                className={styles.filterInput}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </label>
            <label className={styles.filterItem}>
              <span className={styles.filterLabel}>下发时间起</span>
              <input className={styles.filterInput} type="date" value={issueFrom} onChange={(e) => setIssueFrom(e.target.value)} />
            </label>
            <label className={styles.filterItem}>
              <span className={styles.filterLabel}>下发时间止</span>
              <input className={styles.filterInput} type="date" value={issueTo} onChange={(e) => setIssueTo(e.target.value)} />
            </label>
          </div>
        </details>
      </div>

      <div className={`${styles.tableWrap} ${loading ? styles.tableWrapLoading : ""}`}>
        {loading && (
          <div className={styles.tableLoadingOverlay} role="status" aria-live="polite">
            <div className={styles.spinner} aria-hidden />
            <span className={styles.loadingText}>加载中…</span>
          </div>
        )}
        <table className={`${styles.table} ${loading ? styles.tableLoadingDim : ""}`}>
          <thead>
            <tr>
              <th>类别</th>
              <th>企业名称</th>
              <th>下发地址</th>
              <th>所在省</th>
              <th>所在市</th>
              <th>所在区</th>
              <th>CCIF</th>
              <th>客户经理</th>
              <th>分中心负责人</th>
              <th>下发时间</th>
              <th>额度</th>
              <th>联系电话</th>
              <th>渠道</th>
              <th>接力棒标签</th>
              <th>是否实际上门</th>
              <th>是否见到客户</th>
              <th>名单是否退回</th>
              <th>退回原因</th>
              <th>最近一次上门时间</th>
              <th>预约上门时间</th>
              <th>实际上门时间</th>
              <th>联系/走访备注</th>
              <th>MGM</th>
              <th>导入批次</th>
              <th className={styles.colOp}>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && !loading ? (
              <tr>
                <td colSpan={25} className={styles.muted}>
                  暂无数据，请先导入 Excel
                </td>
              </tr>
            ) : records.length === 0 && loading ? (
              <tr>
                <td colSpan={25} className={styles.loadingPlaceholderCell} />
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td>{SHEET_LABELS[r.sheetKind] ?? r.sheetKind}</td>
                  <td>{r.customerName ?? "—"}</td>
                  <td className={styles.cellLong} title={r.issuedAddress ?? undefined}>
                    {r.issuedAddress?.trim() ? r.issuedAddress : "—"}
                  </td>
                  <td>{r.province ?? "—"}</td>
                  <td>{r.city ?? "—"}</td>
                  <td>{r.district ?? "—"}</td>
                  <td>{r.ccif ?? "—"}</td>
                  <td>{r.ownerName ?? "—"}</td>
                  <td>{r.branchOwnerName ?? "—"}</td>
                  <td>{fmtDate(r.issueTime)}</td>
                  <td>{r.quotaAmount ?? "—"}</td>
                  <td>{r.contactPhone ?? "—"}</td>
                  <td>{r.channel ?? "—"}</td>
                  <td>{r.relayTag ?? "—"}</td>
                  <td>{fmtBool(r.actuallyVisited)}</td>
                  <td>{fmtBool(r.metCustomer)}</td>
                  <td>{fmtBool(r.listReturned)}</td>
                  <td className={styles.cellLong} title={r.returnReason ?? undefined}>
                    {r.returnReason?.trim() ? r.returnReason : "—"}
                  </td>
                  <td>{fmtDate(r.lastVisitTime)}</td>
                  <td>{fmtDate(r.scheduledVisitTime)}</td>
                  <td>{fmtDate(r.actualVisitTime)}</td>
                  <td className={styles.cellLong} title={r.visitRemark ?? undefined}>
                    {r.visitRemark?.trim() ? r.visitRemark : "—"}
                  </td>
                  <td>{fmtBool(r.isMgmCustomer)}</td>
                  <td className={styles.cellBatch} title={r.batch?.fileName}>
                    #{r.batch?.id} {r.batch?.fileName}
                  </td>
                  <td className={styles.colOp}>
                    <div className={styles.opRow}>
                      <button type="button" className={styles.linkBtn} onClick={() => openEdit(r)}>
                        修改
                      </button>
                      <span className={styles.opSep}>|</span>
                      <button type="button" className={styles.linkDanger} onClick={() => void deleteRow(r)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editRow && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-enterprise-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div className={styles.modal}>
            <h2 id="edit-enterprise-title" className={styles.modalTitle}>
              修改企业信息
            </h2>
            <p className={styles.modalHint}>
              下发时间为 <strong>只读</strong>（导入时确定，不可在此修改）。如需改额度等数值字段，可后续扩展表单。
            </p>
            <div className={styles.modalGrid}>
              <label className={styles.modalField}>
                <span>企业名称</span>
                <input
                  value={editDraft.customerName}
                  onChange={(e) => setEditDraft((d) => ({ ...d, customerName: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>所在市</span>
                <input
                  value={editDraft.city}
                  onChange={(e) => setEditDraft((d) => ({ ...d, city: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>所在区</span>
                <input
                  value={editDraft.district}
                  onChange={(e) => setEditDraft((d) => ({ ...d, district: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>CCIF</span>
                <input
                  value={editDraft.ccif}
                  onChange={(e) => setEditDraft((d) => ({ ...d, ccif: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>客户经理（导入列「负责人」）</span>
                <input
                  value={editDraft.ownerName}
                  onChange={(e) => setEditDraft((d) => ({ ...d, ownerName: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>分中心负责人</span>
                <input
                  value={editDraft.branchOwnerName}
                  onChange={(e) => setEditDraft((d) => ({ ...d, branchOwnerName: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>联系电话</span>
                <input
                  value={editDraft.contactPhone}
                  onChange={(e) => setEditDraft((d) => ({ ...d, contactPhone: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>名单是否退回</span>
                <select
                  value={editDraft.listReturned}
                  onChange={(e) =>
                    setEditDraft((d) => ({
                      ...d,
                      listReturned: e.target.value as "" | "true" | "false",
                    }))
                  }
                >
                  <option value="">未填</option>
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </label>
              <label className={styles.modalFieldFull}>
                <span>退回原因</span>
                <textarea
                  rows={2}
                  value={editDraft.returnReason}
                  onChange={(e) => setEditDraft((d) => ({ ...d, returnReason: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>渠道</span>
                <input
                  value={editDraft.channel}
                  onChange={(e) => setEditDraft((d) => ({ ...d, channel: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>接力棒标签</span>
                <input
                  value={editDraft.relayTag}
                  onChange={(e) => setEditDraft((d) => ({ ...d, relayTag: e.target.value }))}
                />
              </label>
              <label className={styles.modalFieldFull}>
                <span>电销备注</span>
                <textarea
                  rows={3}
                  value={editDraft.telemarketingNote}
                  onChange={(e) => setEditDraft((d) => ({ ...d, telemarketingNote: e.target.value }))}
                />
              </label>
              <div className={styles.modalReadonly}>
                <span>下发时间（只读）</span>
                <div>{fmtDate(editRow.issueTime)}</div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={closeEdit} disabled={editSaving}>
                取消
              </button>
              <button type="button" className={styles.btnSearch} onClick={() => void submitEdit()} disabled={editSaving}>
                {editSaving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {importConflict && (
        <div
          className={styles.importConflictOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-conflict-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeImportConflict();
          }}
        >
          <div className={styles.importConflictCard}>
            <h2 id="import-conflict-title" className={styles.modalTitle}>
              与库内企业名称重复
              {importConflictDupAllIdenticalToDb ? "（无字段差异）" : ""}
            </h2>
            {importConflictDupAllIdenticalToDb ? (
              <p className={styles.importConflictNoDiffRecommend}>
                本次 Excel 中与库<strong>重名</strong>的行，可比对字段与库中数据<strong>完全一致</strong>，无需执行覆盖更新。
                {importConflict.newRowCount === 0 ? (
                  <>
                    {" "}
                    且无新增企业，建议直接<strong>关闭</strong>。
                  </>
                ) : (
                  <>
                    {" "}
                    若有<strong>新客户</strong>需写入，可使用「仅导入新企业」；不建议对已有行做覆盖。
                  </>
                )}
              </p>
            ) : (
              <p className={styles.importConflictRecommend}>
                业务上建议<strong>以本次导入为最新</strong>：选择下方<strong>「以本次 Excel 为准覆盖更新」</strong>，将保留原记录
                ID，仅更新可导入字段。
              </p>
            )}
            <p className={styles.importConflictHint}>
              唯一键为规范化后的企业名称（Excel「客户名称」）。解析 {importConflict.totalParsedRows} 行，文件内去重后{" "}
              {importConflict.rowsAfterInternalDedupe} 行；其中 <strong>{importConflict.newRowCount}</strong>{" "}
              行为新企业，<strong>{importConflict.duplicateVsDbCount}</strong> 行与库中已有企业重名。
            </p>
            <ImportInternalDedupeDetails data={importConflict} />
            <div className={styles.importDiffScroll}>
              <table className={styles.importDiffTable}>
                <thead>
                  <tr>
                    <th>企业名称（键）</th>
                    <th>本次 Sheet / 行</th>
                    <th>库中记录</th>
                    <th>差异（节选）</th>
                  </tr>
                </thead>
                <tbody>
                  {importConflict.duplicateSamples.map((s) => (
                    <tr key={`${s.normalizedKey}-${s.rowIndex}-${s.sheetKind}`}>
                      <td className={styles.importDiffCellKey}>{s.normalizedKey}</td>
                      <td>
                        {s.sheetKindLabel} · 第 {s.rowIndex + 1} 行
                      </td>
                      <td>
                        ID {s.existing.id}，批次 #{s.existing.batchId}，{s.existing.sheetKindLabel}
                      </td>
                      <td
                        className={
                          s.diffFields.length > 0
                            ? `${styles.importDiffCellDiff} ${styles.importDiffCellDiffHighlight}`
                            : styles.importDiffCellDiff
                        }
                      >
                        {s.diffFields.length === 0 ? (
                          <span className={styles.muted}>可比对字段一致</span>
                        ) : (
                          <ul className={styles.importDiffListAlert}>
                            {s.diffFields.map((d) => (
                              <li key={d.field}>
                                <strong>{d.label}</strong>：库「{d.oldValue || "—"}」→ 本次「{d.newValue || "—"}」
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importConflict.duplicateSamplesTruncated ? (
              <p className={styles.importConflictHint}>
                仅展示前 {importConflict.duplicateSamples.length} 条，其余请在导入后于列表中核对。
              </p>
            ) : null}
            <div className={styles.importConflictActions}>
              {importConflictDupAllIdenticalToDb ? (
                importConflict.newRowCount === 0 ? (
                  <button
                    type="button"
                    className={styles.importConflictBtnPrimary}
                    onClick={closeImportConflict}
                    disabled={importing}
                  >
                    关闭
                  </button>
                ) : (
                  <>
                    <button type="button" className={styles.btnGhost} onClick={closeImportConflict} disabled={importing}>
                      取消
                    </button>
                    <button
                      type="button"
                      className={styles.importConflictBtnPrimary}
                      onClick={() => void confirmImportWithMode("skip_existing")}
                      disabled={importing}
                    >
                      仅导入新企业
                    </button>
                  </>
                )
              ) : (
                <>
                  <button type="button" className={styles.btnGhost} onClick={closeImportConflict} disabled={importing}>
                    取消
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => void confirmImportWithMode("skip_existing")}
                    disabled={importing}
                  >
                    仅导入新企业（跳过重复）
                  </button>
                  <button
                    type="button"
                    className={styles.importConflictBtnPrimary}
                    onClick={() => void confirmImportWithMode("upsert")}
                    disabled={importing}
                  >
                    以本次 Excel 为准覆盖更新（推荐）
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {importFileDedupePreview && (
        <div
          className={styles.importConflictOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-file-dedupe-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeImportFileDedupe();
          }}
        >
          <div className={styles.importConflictCard}>
            <h2 id="import-file-dedupe-title" className={styles.modalTitle}>
              Excel 内存在重复客户名称
            </h2>
            <p className={styles.importConflictHint}>
              与数据库中已有企业名称 <strong>无重名</strong>；重复仅出现在本次上传的 Excel 中。解析{" "}
              {importFileDedupePreview.totalParsedRows} 行，同名按<strong>最后一行</strong>合并后{" "}
              {importFileDedupePreview.rowsAfterInternalDedupe} 行将参与导入。请确认后再写入。
            </p>
            <ImportInternalDedupeDetails data={importFileDedupePreview} defaultOpen />
            <div className={styles.importConflictActions}>
              <button type="button" className={styles.btnGhost} onClick={closeImportFileDedupe} disabled={importing}>
                取消
              </button>
              <button
                type="button"
                className={styles.importConflictBtnPrimary}
                onClick={() => void confirmFileDedupeImport()}
                disabled={importing}
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className={styles.pagination}>
          <span className={styles.muted}>
            共 {total} 条，第 {page} / {totalPages} 页
          </span>
          <div className={styles.pageBtns}>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {(importing || importAnalyzing) && (
        <div
          className={styles.importProgressOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-progress-title"
        >
          <div className={styles.importProgressCard}>
            <h2 id="import-progress-title" className={styles.importProgressTitle}>
              {importAnalyzing ? "正在分析 Excel…" : "数据导入中"}
            </h2>
            <p className={styles.importProgressSub}>
              {importAnalyzing
                ? "分析为单次请求，无法显示精确百分比。点「取消」会中断浏览器等待（服务端若已在计算，仍可能继续片刻）。"
                : "大文件将分多批写入数据库；进度会实时更新。点「取消」将中断本地等待，服务器端可能仍在处理，可稍后刷新列表确认。"}
            </p>
            {importProgress?.indeterminate ? (
              <div className={styles.importProgressTrackIndeterminate} aria-hidden>
                <div className={styles.importProgressIndeterminateBar} />
              </div>
            ) : (
              <div className={styles.importProgressTrack} aria-hidden>
                <div
                  className={styles.importProgressFill}
                  style={{ width: `${importProgress?.percent ?? 0}%` }}
                />
              </div>
            )}
            <div className={styles.importProgressPercentRow}>
              {importProgress?.indeterminate ? (
                <span className={styles.importProgressPercentNum}>处理中…</span>
              ) : (
                <>
                  <span className={styles.importProgressPercentNum}>{importProgress?.percent ?? 0}%</span>
                  {importProgress?.chunkLabel ? (
                    <span className={styles.importProgressChunk}>{importProgress.chunkLabel}</span>
                  ) : null}
                </>
              )}
            </div>
            <p className={styles.importProgressMsg}>{importProgress?.message ?? "准备中…"}</p>
            <p className={styles.importProgressStep}>
              当前阶段：
              {IMPORT_STEP_LABEL[importProgress?.step ?? ""] ?? importProgress?.step ?? "—"}
            </p>
            <button
              type="button"
              className={styles.importProgressCancel}
              onClick={() => {
                importAbortRef.current?.abort();
              }}
            >
              {importAnalyzing ? "取消分析" : "取消导入"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
