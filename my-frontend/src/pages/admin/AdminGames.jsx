import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import { AdminLayout } from "./AdminDashboard";
import { useFlash } from "../../App";

export default function AdminGames() {
  const { flash } = useFlash();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [controlling, setControlling] = useState(false);

  const load = () => {
    api.get("/admin-panel/games/").then((r) => setRounds(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const control = async (action) => {
    setControlling(true);
    try {
      const res = await api.post("/admin-panel/games/control/", { action });
      flash(res.data.detail, "success");
      load();
    } catch (err) {
      flash(err.response?.data?.detail || "Action failed.", "error");
    } finally {
      setControlling(false);
    }
  };

  const chipClass = (v) => {
    const n = parseFloat(v);
    if (n < 2) return "chip-low";
    if (n < 10) return "chip-mid";
    if (n < 100) return "chip-high";
    return "chip-moon";
  };

  return (
    <AdminLayout>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, color: "var(--accent)", marginBottom: 16 }}>
        GAME CONTROL
      </div>

      {/* Control buttons */}
      <div className="card-shabiki p-3 mb-4">
        <div style={{ color: "var(--text-muted)", fontSize: ".75rem", letterSpacing: 1, fontFamily: "var(--font-display)", marginBottom: 12 }}>
          LIVE CONTROLS
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-ghost btn-sm" disabled={controlling} onClick={() => control("pause")}
            style={{ fontFamily: "var(--font-display)", fontSize: ".72rem", letterSpacing: 1 }}>
            <i className="bi bi-pause-fill me-1" />PAUSE GAME
          </button>
          <button className="btn btn-cyan btn-sm" disabled={controlling} onClick={() => control("resume")}
            style={{ fontFamily: "var(--font-display)", fontSize: ".72rem", letterSpacing: 1 }}>
            <i className="bi bi-play-fill me-1" />RESUME
          </button>
          <button
            className="btn btn-sm"
            style={{ background: "#450a0a", border: "1px solid var(--red)", color: "var(--red)", borderRadius: 8, fontFamily: "var(--font-display)", fontSize: ".72rem", letterSpacing: 1 }}
            disabled={controlling}
            onClick={() => { if (window.confirm("Force crash the active round?")) control("force_crash"); }}
          >
            <i className="bi bi-lightning-fill me-1" />FORCE CRASH
          </button>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <i className="bi bi-arrow-repeat me-1" />Refresh
          </button>
        </div>
      </div>

      {/* Rounds table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          <span className="spin"><i className="bi bi-arrow-repeat" /></span>
        </div>
      ) : (
        <div className="card-shabiki" style={{ overflowX: "auto" }}>
          <table className="table-shabiki">
            <thead>
              <tr>
                <th>Round ID</th><th>Status</th><th>Crash Point</th>
                <th>Speed</th><th>Started</th><th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => {
                const dur = r.started_at && r.crashed_at
                  ? ((new Date(r.crashed_at) - new Date(r.started_at)) / 1000).toFixed(1) + "s"
                  : "—";
                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "var(--font-display)", fontSize: ".72rem", color: "var(--text-muted)" }}>
                      {r.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td><span className={`badge-status badge-${r.status}`}>{r.status}</span></td>
                    <td>
                      {r.crash_point
                        ? <span className={`history-chip ${chipClass(r.crash_point)}`}>{parseFloat(r.crash_point).toFixed(2)}×</span>
                        : <span style={{ color: "var(--text-dim)" }}>—</span>}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{r.speed_factor || "—"}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: ".75rem" }}>
                      {r.started_at ? new Date(r.started_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{dur}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}