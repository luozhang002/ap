"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type EnterpriseImportStreamEvent,
  readNdjsonLines,
} from "@/lib/enterprise-import-ndjson";
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
  region: string | null;
  district: string | null;
  ccif: string | null;
  customerName: string | null;
  issuedAddress: string | null;
  addressVerifyLabelBank: string | null;
  quotaAmount: string | null;
  bestPackagePrice: string | null;
  newOrExistingCustomer: string | null;
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

export function EnterprisesManagement() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    percent: number;
    message: string;
    step: string;
    chunkLabel?: string;
  } | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  /** 主筛选：企业名称 */
  const [customerName, setCustomerName] = useState("");
  /** 客户经理 → 库字段「分中心负责人」 */
  const [branchOwnerName, setBranchOwnerName] = useState("");
  const [region, setRegion] = useState("");
  /** 负责人 → 库字段「负责人」 */
  const [ownerName, setOwnerName] = useState("");

  const [sheetKind, setSheetKind] = useState("");
  const [batchId, setBatchId] = useState("");
  const [district, setDistrict] = useState("");
  const [issueFrom, setIssueFrom] = useState("");
  const [issueTo, setIssueTo] = useState("");

  const [editRow, setEditRow] = useState<RecordRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editDraft, setEditDraft] = useState({
    customerName: "",
    region: "",
    district: "",
    ccif: "",
    branchOwnerName: "",
    ownerName: "",
    contactPhone: "",
    channel: "",
    relayTag: "",
    telemarketingNote: "",
  });

  const showError = (text: string) => setToast({ type: "error", text });
  const showSuccess = (text: string) => setToast({ type: "success", text });

  useEffect(() => {
    if (!toast || toast.type !== "success") return;
    const t = setTimeout(() => setToast(null), 3200);
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
        if (branchOwnerName.trim()) p.set("branchOwnerName", branchOwnerName.trim());
        if (region.trim()) p.set("region", region.trim());
        if (district.trim()) p.set("district", district.trim());
        if (ownerName.trim()) p.set("ownerName", ownerName.trim());
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
      branchOwnerName,
      region,
      district,
      ownerName,
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
      region: r.region ?? "",
      district: r.district ?? "",
      ccif: r.ccif ?? "",
      branchOwnerName: r.branchOwnerName ?? "",
      ownerName: r.ownerName ?? "",
      contactPhone: r.contactPhone ?? "",
      channel: r.channel ?? "",
      relayTag: r.relayTag ?? "",
      telemarketingNote: r.telemarketingNote ?? "",
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
          region: editDraft.region,
          district: editDraft.district,
          ccif: editDraft.ccif,
          branchOwnerName: editDraft.branchOwnerName,
          ownerName: editDraft.ownerName,
          contactPhone: editDraft.contactPhone,
          channel: editDraft.channel,
          relayTag: editDraft.relayTag,
          telemarketingNote: editDraft.telemarketingNote,
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

  const submitImport = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    importAbortRef.current?.abort();
    const ac = new AbortController();
    importAbortRef.current = ac;

    setImporting(true);
    setImportProgress({ percent: 0, message: "连接服务器…", step: "init" });

    let streamError: string | null = null;
    let doneBatch: {
      id: number;
      totalRows: number;
      rowCountYilei: number;
      rowCountFeichanggui: number;
      rowCountJieliebang: number;
    } | null = null;

    try {
      const fd = new FormData();
      fd.set("file", file);
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

      await readNdjsonLines(res.body, (ev: EnterpriseImportStreamEvent) => {
        if (ev.type === "progress") {
          setImportProgress({
            percent: Math.min(100, Math.max(0, Math.round(ev.percent))),
            message: ev.message,
            step: ev.step,
            chunkLabel:
              ev.currentChunk != null && ev.totalChunks != null
                ? `第 ${ev.currentChunk} / ${ev.totalChunks} 批`
                : undefined,
          });
        } else if (ev.type === "error") {
          streamError = ev.message;
        } else if (ev.type === "done") {
          doneBatch = ev.batch;
        }
      });

      if (streamError) {
        showError(streamError);
        return;
      }
      if (doneBatch) {
        const b = doneBatch;
        showSuccess(
          `导入成功：共 ${b.totalRows} 行（一类 ${b.rowCountYilei} / 非常规 ${b.rowCountFeichanggui} / 接力棒 ${b.rowCountJieliebang}）`
        );
        const newBatchId = String(b.id);
        setBatchId(newBatchId);
        setPage(1);
        await loadBatches();
        await fetchRecordsForPage(1, { batchIdOverride: newBatchId });
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

  const resetFilters = () => {
    setCustomerName("");
    setBranchOwnerName("");
    setRegion("");
    setOwnerName("");
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
      "下发的地址",
      "地区",
      "所在区",
      "CCIF",
      "客户经理",
      "负责人",
      "下发时间",
      "额度",
      "联系电话",
      "渠道",
      "接力棒标签",
      "是否实际上门",
      "是否见到客户",
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
          r.region ?? "",
          r.district ?? "",
          r.ccif ?? "",
          r.branchOwnerName ?? "",
          r.ownerName ?? "",
          r.issueTime ? fmtDate(r.issueTime) : "",
          r.quotaAmount ?? "",
          r.contactPhone ?? "",
          r.channel ?? "",
          r.relayTag ?? "",
          fmtBool(r.actuallyVisited),
          fmtBool(r.metCustomer),
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
        Excel 须含 <strong>3 个工作表</strong>（顺序：一类 / 非常规名单 / 接力棒）。主筛可选类别；客户经理对应「分中心负责人」列；更多筛选中可填负责人。
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
              placeholder="请输入客户经理"
              value={branchOwnerName}
              onChange={(e) => setBranchOwnerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
            />
          </label>
          <label className={styles.filterItem}>
            <span className={styles.filterLabel}>地区</span>
            <input
              className={styles.filterInput}
              placeholder="请输入地区"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
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
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? "导入中…" : "导入"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className={styles.hiddenFile}
              aria-label="上传 Excel 导入"
              disabled={importing}
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
              <span className={styles.filterLabel}>负责人</span>
              <input
                className={styles.filterInput}
                placeholder="请输入负责人"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
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
              <th>下发的地址</th>
              <th>地区</th>
              <th>所在区</th>
              <th>CCIF</th>
              <th>客户经理</th>
              <th>负责人</th>
              <th>下发时间</th>
              <th>额度</th>
              <th>联系电话</th>
              <th>渠道</th>
              <th>接力棒标签</th>
              <th>是否实际上门</th>
              <th>是否见到客户</th>
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
                <td colSpan={22} className={styles.muted}>
                  暂无数据，请先导入 Excel
                </td>
              </tr>
            ) : records.length === 0 && loading ? (
              <tr>
                <td colSpan={22} className={styles.loadingPlaceholderCell} />
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td>{SHEET_LABELS[r.sheetKind] ?? r.sheetKind}</td>
                  <td>{r.customerName ?? "—"}</td>
                  <td className={styles.cellLong} title={r.issuedAddress ?? undefined}>
                    {r.issuedAddress?.trim() ? r.issuedAddress : "—"}
                  </td>
                  <td>{r.region ?? "—"}</td>
                  <td>{r.district ?? "—"}</td>
                  <td>{r.ccif ?? "—"}</td>
                  <td>{r.branchOwnerName ?? "—"}</td>
                  <td>{r.ownerName ?? "—"}</td>
                  <td>{fmtDate(r.issueTime)}</td>
                  <td>{r.quotaAmount ?? "—"}</td>
                  <td>{r.contactPhone ?? "—"}</td>
                  <td>{r.channel ?? "—"}</td>
                  <td>{r.relayTag ?? "—"}</td>
                  <td>{fmtBool(r.actuallyVisited)}</td>
                  <td>{fmtBool(r.metCustomer)}</td>
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
                <span>地区</span>
                <input
                  value={editDraft.region}
                  onChange={(e) => setEditDraft((d) => ({ ...d, region: e.target.value }))}
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
                <span>客户经理（分中心负责人）</span>
                <input
                  value={editDraft.branchOwnerName}
                  onChange={(e) => setEditDraft((d) => ({ ...d, branchOwnerName: e.target.value }))}
                />
              </label>
              <label className={styles.modalField}>
                <span>负责人</span>
                <input
                  value={editDraft.ownerName}
                  onChange={(e) => setEditDraft((d) => ({ ...d, ownerName: e.target.value }))}
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

      {importing && (
        <div
          className={styles.importProgressOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-progress-title"
        >
          <div className={styles.importProgressCard}>
            <h2 id="import-progress-title" className={styles.importProgressTitle}>
              数据导入中
            </h2>
            <p className={styles.importProgressSub}>
              大文件将分多批写入数据库；进度会实时更新。点「取消」将中断本地等待，服务器端可能仍在处理，可稍后刷新列表确认。
            </p>
            <div className={styles.importProgressTrack} aria-hidden>
              <div
                className={styles.importProgressFill}
                style={{ width: `${importProgress?.percent ?? 0}%` }}
              />
            </div>
            <div className={styles.importProgressPercentRow}>
              <span className={styles.importProgressPercentNum}>{importProgress?.percent ?? 0}%</span>
              {importProgress?.chunkLabel ? (
                <span className={styles.importProgressChunk}>{importProgress.chunkLabel}</span>
              ) : null}
            </div>
            <p className={styles.importProgressMsg}>{importProgress?.message ?? "准备中…"}</p>
            <p className={styles.importProgressStep}>
              当前阶段：
              {IMPORT_STEP_LABEL[importProgress?.step ?? ""] ?? importProgress?.step ?? "—"}
            </p>
            <button type="button" className={styles.importProgressCancel} onClick={() => importAbortRef.current?.abort()}>
              取消导入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
