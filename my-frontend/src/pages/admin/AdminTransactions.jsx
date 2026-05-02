// pages/admin/AdminTransactions.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useFlash } from "../../App";
import api from "../../utils/api";

const STATUS_META = {
  pending:   { label: "Pending",   bg: "#1e293b", color: "#facc15", dot: "#facc15" },
  approved:  { label: "Approved",  bg: "#052e16", color: "#4ade80", dot: "#4ade80" },
  completed: { label: "Completed", bg: "#052e16", color: "#4ade80", dot: "#22d3ee" },
  rejected:  { label: "Rejected",  bg: "#2d0a0a", color: "#ef4444", dot: "#ef4444" },
  failed:    { label: "Failed",    bg: "#2d0a0a", color: "#f87171", dot: "#f87171" },
};

const TYPE_META = {
  deposit:    { label: "Deposit",    icon: "↓", color: "#4ade80" },
  withdrawal: { label: "Withdrawal", icon: "↑", color: "#f87171" },
  bet:        { label: "Bet",        icon: "🎰", color: "#94a3b8" },
  win:        { label: "Win",        icon: "🏆", color: "#facc15" },
};

const METHOD_ICONS = {
  mpesa:  "📱",
  paypal: "🅿️",
  dev:    "⚡",
};

const PAGE_SIZE = 20;

export default function AdminTransactions() {
  const { flash } = useFlash();

  const [txns, setTxns]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [processing, setProcessing] = useState(null);
  const [selected, setSelected]   = useState(null); // detail modal

  const [filters, setFilters] = useState({
    status: "",
    type: "",
    method: "",
    search: "",
  });

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (filters.status) params.status = filters.status;
      if (filters.type)   params.type   = filters.type;
      if (filters.method) params.method = filters.method;
      if (filters.search) params.search = filters.search;

      const { data } = await api.get("/admin/transactions/", { params });
      setTxns(data.results ?? data);
      setTotal(data.count ?? (data.results ?? data).length);
    } catch {
      flash("Failed to load transactions", "danger");
    } finally {
      setLoading(false);
    }
  }, [page, filters, flash]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);

  const handleApprove = async (id) => {
    setProcessing(id);
    try {
      await api.post(`/admin/transactions/${id}/approve/`);
      flash("Transaction approved", "success");
      fetchTxns();
      setSelected(null);
    } catch {
      flash("Failed to approve transaction", "danger");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Reject this transaction?")) return;
    setProcessing(id);
    try {
      await api.post(`/admin/transactions/${id}/reject/`);
      flash("Transaction rejected", "warning");
      fetchTxns();
      setSelected(null);
    } catch {
      flash("Failed to reject transaction", "danger");
    } finally {
      setProcessing(null);
    }
  };

  const handleExport = async () => {
    try {
      const { data } = await api.get("/admin/transactions/export/", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      flash("Export failed", "danger");
    }
  };

  const filterChange = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Admin / Transactions</div>
          <h1 style={s.title}>Transaction Ledger</h1>
          <div style={s.subtitle}>{total.toLocaleString()} total records</div>
        </div>
        <button style={s.exportBtn} onClick={handleExport}>
          ⬇ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={s.filtersRow}>
        <input
          style={s.searchInput}
          placeholder="Search by user, ref ID…"
          value={filters.search}
          onChange={(e) => filterChange("search", e.target.value)}
        />
        {[
          { key: "status", options: ["","pending","approved","completed","rejected","failed"], labels: ["All Status","Pending","Approved","Completed","Rejected","Failed"] },
          { key: "type",   options: ["","deposit","withdrawal","bet","win"],                  labels: ["All Types","Deposit","Withdrawal","Bet","Win"] },
          { key: "method", options: ["","mpesa","paypal","dev"],                              labels: ["All Methods","M-Pesa","PayPal","Dev"] },
        ].map(({ key, options, labels }) => (
          <select
            key={key}
            style={s.select}
            value={filters[key]}
            onChange={(e) => filterChange(key, e.target.value)}
          >
            {options.map((o, i) => <option key={o} value={o}>{labels[i]}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading && <div style={s.loadingBar} />}
        <table style={s.table}>
          <thead>
            <tr>
              {["ID","User","Type","Method","Amount","Status","Date","Actions"].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txns.length === 0 && !loading && (
              <tr><td colSpan={8} style={s.empty}>No transactions found</td></tr>
            )}
            {txns.map((tx) => {
              const sm = STATUS_META[tx.status] || STATUS_META.pending;
              const tm = TYPE_META[tx.type]     || { label: tx.type, icon: "·", color: "#94a3b8" };
              const mm = METHOD_ICONS[tx.method] || "·";
              return (
                <tr
                  key={tx.id}
                  style={s.tr}
                  onClick={() => setSelected(tx)}
                >
                  <td style={s.td}>
                    <span style={s.mono}>#{tx.id}</span>
                  </td>
                  <td style={s.td}>
                    <div style={s.username}>{tx.user_username || tx.user}</div>
                    {tx.phone && <div style={s.sub}>{tx.phone}</div>}
                  </td>
                  <td style={s.td}>
                    <span style={{ color: tm.color, fontWeight: 700 }}>
                      {tm.icon} {tm.label}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={s.badge}>{mm} {tx.method?.toUpperCase()}</span>
                  </td>
                  <td style={{ ...s.td, fontWeight: 700 }}>
                    <span style={{ color: tx.type === "deposit" || tx.type === "win" ? "#4ade80" : "#f87171" }}>
                      {tx.type === "deposit" || tx.type === "win" ? "+" : "−"}
                      KES {Number(tx.amount).toLocaleString()}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.statusBadge, background: sm.bg, color: sm.color }}>
                      <span style={{ ...s.dot, background: sm.dot }} />
                      {sm.label}
                    </span>
                  </td>
                  <td style={{ ...s.td, ...s.mono, color: "#64748b", fontSize: 12 }}>
                    {new Date(tx.created_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td style={s.td} onClick={(e) => e.stopPropagation()}>
                    {tx.status === "pending" && (
                      <div style={s.actionBtns}>
                        <button
                          style={s.approveBtn}
                          disabled={processing === tx.id}
                          onClick={() => handleApprove(tx.id)}
                        >
                          {processing === tx.id ? "…" : "✓"}
                        </button>
                        <button
                          style={s.rejectBtn}
                          disabled={processing === tx.id}
                          onClick={() => handleReject(tx.id)}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={s.pagination}>
        <span style={s.pageInfo}>Page {page} of {totalPages}</span>
        <div style={s.pageBtns}>
          <button style={s.pageBtn} disabled={page === 1}         onClick={() => setPage(1)}>«</button>
          <button style={s.pageBtn} disabled={page === 1}         onClick={() => setPage((p) => p - 1)}>‹</button>
          <button style={s.pageBtn} disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          <button style={s.pageBtn} disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={s.overlay} onClick={() => setSelected(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>Transaction #{selected.id}</span>
              <button style={s.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {[
                ["User",       selected.user_username || selected.user],
                ["Type",       `${TYPE_META[selected.type]?.icon || ""} ${selected.type}`],
                ["Method",     `${METHOD_ICONS[selected.method] || ""} ${selected.method?.toUpperCase()}`],
                ["Amount",     `KES ${Number(selected.amount).toLocaleString()}`],
                ["Status",     selected.status],
                ["Reference",  selected.reference || "—"],
                ["Checkout ID",selected.checkout_id || "—"],
                ["Created",    new Date(selected.created_at).toLocaleString("en-KE")],
                ["Updated",    selected.updated_at ? new Date(selected.updated_at).toLocaleString("en-KE") : "—"],
              ].map(([label, val]) => (
                <div key={label} style={s.detailRow}>
                  <span style={s.detailLabel}>{label}</span>
                  <span style={s.detailVal}>{val}</span>
                </div>
              ))}
            </div>
            {selected.status === "pending" && (
              <div style={s.modalFooter}>
                <button
                  style={{ ...s.approveBtn, padding: "10px 24px", fontSize: 14 }}
                  disabled={processing === selected.id}
                  onClick={() => handleApprove(selected.id)}
                >
                  {processing === selected.id ? "Processing…" : "✓ Approve"}
                </button>
                <button
                  style={{ ...s.rejectBtn, padding: "10px 24px", fontSize: 14 }}
                  disabled={processing === selected.id}
                  onClick={() => handleReject(selected.id)}
                >
                  ✕ Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Styles ── */
const s = {
  page:       { minHeight: "100vh", background: "#030712", color: "#e2e8f0", padding: "32px 24px", fontFamily: "'Courier New', monospace" },
  header:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  breadcrumb: { fontSize: 12, color: "#475569", letterSpacing: "0.1em", marginBottom: 6 },
  title:      { margin: 0, fontSize: 28, fontWeight: 900, fontFamily: "Georgia, serif", color: "#f8fafc" },
  subtitle:   { fontSize: 13, color: "#64748b", marginTop: 4 },
  exportBtn:  { background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 13, letterSpacing: "0.05em", transition: "all 0.2s" },
  filtersRow: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  searchInput:{ flex: 1, minWidth: 200, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 13, outline: "none" },
  select:     { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#94a3b8", padding: "10px 12px", fontSize: 13, outline: "none", cursor: "pointer" },
  tableWrap:  { overflowX: "auto", borderRadius: 12, border: "1px solid #1e293b", position: "relative" },
  loadingBar: { position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #0f172a, #22d3ee, #0f172a)", backgroundSize: "200% 100%", animation: "shimmer 1.2s linear infinite", zIndex: 2 },
  table:      { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th:         { padding: "14px 16px", textAlign: "left", fontSize: 11, letterSpacing: "0.12em", color: "#475569", borderBottom: "1px solid #1e293b", background: "#0a1120", textTransform: "uppercase" },
  tr:         { cursor: "pointer", transition: "background 0.15s", borderBottom: "1px solid #0f172a" },
  td:         { padding: "13px 16px", verticalAlign: "middle" },
  mono:       { fontFamily: "'Courier New', monospace" },
  username:   { fontWeight: 700, color: "#e2e8f0" },
  sub:        { fontSize: 11, color: "#475569", marginTop: 2 },
  badge:      { background: "#1e293b", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#94a3b8" },
  statusBadge:{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" },
  dot:        { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  actionBtns: { display: "flex", gap: 6 },
  approveBtn: { background: "#052e16", border: "1px solid #4ade80", color: "#4ade80", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12, transition: "all 0.2s" },
  rejectBtn:  { background: "#2d0a0a", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12, transition: "all 0.2s" },
  empty:      { textAlign: "center", color: "#475569", padding: "48px 0", fontSize: 14 },
  pagination: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
  pageInfo:   { fontSize: 12, color: "#475569" },
  pageBtns:   { display: "flex", gap: 6 },
  pageBtn:    { background: "#0f172a", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 13, transition: "all 0.2s" },
  // Modal
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" },
  modal:      { background: "#0a1120", border: "1px solid #1e293b", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 0 60px rgba(34,211,238,0.1)" },
  modalHeader:{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #1e293b" },
  modalTitle: { fontFamily: "Georgia, serif", fontWeight: 900, fontSize: 18, color: "#f8fafc" },
  closeBtn:   { background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18 },
  modalBody:  { padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 },
  detailRow:  { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #0f172a", paddingBottom: 8 },
  detailLabel:{ fontSize: 12, color: "#475569", letterSpacing: "0.08em" },
  detailVal:  { fontSize: 13, color: "#e2e8f0", fontWeight: 600 },
  modalFooter:{ display: "flex", gap: 12, padding: "16px 24px", borderTop: "1px solid #1e293b" },
};