import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import { AdminLayout } from "./AdminDashboard";
import { useFlash } from "../../App";

export default function AdminUsers() {
  const { flash } = useFlash();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const load = () => {
    api.get("/admin-panel/users/").then((r) => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = users.filter(
    (u) => u.username.toLowerCase().includes(search.toLowerCase()) || u.email?.includes(search)
  );

  const toggleBan = async (userId, username) => {
    try {
      const res = await api.post(`/admin-panel/users/${userId}/ban/`);
      flash(res.data.detail, "success");
      load();
    } catch { flash("Action failed.", "error"); }
  };

  const adjustBalance = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await api.post(`/admin-panel/users/${selected.id}/adjust/`, {
        amount: parseFloat(adjustAmt),
        note: adjustNote || "Admin adjustment",
      });
      flash(res.data.detail, "success");
      setSelected(null);
      setAdjustAmt("");
      load();
    } catch (err) {
      flash(err.response?.data?.detail || "Adjustment failed.", "error");
    }
  };

  return (
    <AdminLayout>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>
          USER MANAGEMENT
        </div>
        <input
          className="form-control-shabiki"
          placeholder="Search username / email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
      </div>

      {/* Adjust balance modal-like panel */}
      {selected && (
        <div className="card-shabiki p-3 mb-3" style={{ border: "1px solid var(--accent)", maxWidth: 420 }}>
          <div style={{ color: "var(--accent)", fontFamily: "var(--font-display)", fontSize: ".8rem", marginBottom: 10 }}>
            ADJUST BALANCE — {selected.username}
          </div>
          <form onSubmit={adjustBalance} className="d-flex flex-column gap-2">
            <input className="form-control-shabiki" type="number" placeholder="Amount (negative to deduct)"
              value={adjustAmt} onChange={(e) => setAdjustAmt(e.target.value)} required />
            <input className="form-control-shabiki" placeholder="Note" value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)} />
            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-orange btn-sm flex-grow-1"
                style={{ fontFamily: "var(--font-display)", fontSize: ".72rem" }}>APPLY</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          <span className="spin"><i className="bi bi-arrow-repeat" /></span>
        </div>
      ) : (
        <div className="card-shabiki" style={{ overflowX: "auto" }}>
          <table className="table-shabiki">
            <thead>
              <tr>
                <th>User</th><th>Balance</th><th>Wagered</th><th>Won</th>
                <th>Status</th><th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.username}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: ".72rem" }}>{u.email}</div>
                  </td>
                  <td className="text-green">{parseFloat(u.balance).toLocaleString()}</td>
                  <td>{parseFloat(u.total_wagered).toLocaleString()}</td>
                  <td>{parseFloat(u.total_won).toLocaleString()}</td>
                  <td>
                    {u.is_banned
                      ? <span className="badge-status badge-failed">Banned</span>
                      : u.is_staff
                      ? <span className="badge-status badge-flying">Admin</span>
                      : <span className="badge-status badge-completed">Active</span>}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: ".72rem" }}>
                    {new Date(u.date_joined).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <button className="btn btn-ghost btn-sm" title="Adjust balance" onClick={() => setSelected(u)}>
                        <i className="bi bi-cash" />
                      </button>
                      <button
                        className={`btn btn-sm ${u.is_banned ? "btn-outline-orange" : "btn-ghost"}`}
                        title={u.is_banned ? "Unban" : "Ban"}
                        onClick={() => toggleBan(u.id, u.username)}
                      >
                        <i className={`bi ${u.is_banned ? "bi-unlock" : "bi-ban"}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}