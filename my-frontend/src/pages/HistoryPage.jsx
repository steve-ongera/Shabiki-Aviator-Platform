import React, { useEffect, useState } from "react";
import api from "../utils/api";

export function HistoryPage() {
  const [bets, setBets] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [tab, setTab] = useState("bets");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/game/my-bets/"),
      api.get("/game/rounds/"),
    ]).then(([b, r]) => {
      setBets(b.data);
      setRounds(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const chipClass = (v) => {
    const n = parseFloat(v);
    if (n < 2) return "chip-low";
    if (n < 10) return "chip-mid";
    if (n < 100) return "chip-high";
    return "chip-moon";
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 12px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, marginBottom: 16, color: "var(--accent)" }}>
        HISTORY
      </div>

      <div className="d-flex gap-2 mb-3">
        {["bets", "rounds"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "btn btn-orange btn-sm" : "btn btn-ghost btn-sm"}
            style={{ fontFamily: "var(--font-display)", fontSize: ".72rem", letterSpacing: 1, textTransform: "uppercase" }}>
            {t === "bets" ? "My Bets" : "All Rounds"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          <span className="spin"><i className="bi bi-arrow-repeat" /></span>
        </div>
      ) : tab === "bets" ? (
        <div className="card-shabiki">
          <table className="table-shabiki">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount (KES)</th>
                <th>Cashout ×</th>
                <th>Payout (KES)</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {bets.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "var(--text-dim)" }}>No bets yet</td></tr>
              ) : bets.map((b) => (
                <tr key={b.id}>
                  <td style={{ color: "var(--text-muted)" }}>{new Date(b.placed_at).toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>{parseFloat(b.amount).toLocaleString()}</td>
                  <td>
                    {b.cashout_multiplier
                      ? <span style={{ fontFamily: "var(--font-display)", color: "var(--green)" }}>{parseFloat(b.cashout_multiplier).toFixed(2)}×</span>
                      : <span style={{ color: "var(--text-dim)" }}>—</span>}
                  </td>
                  <td>{b.payout > 0 ? <span className="text-green">{parseFloat(b.payout).toLocaleString()}</span> : "—"}</td>
                  <td><span className={`badge-status badge-${b.status}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card-shabiki">
          <table className="table-shabiki">
            <thead>
              <tr>
                <th>Round</th>
                <th>Crash Point</th>
                <th>Started</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {rounds.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--text-dim)" }}>No rounds yet</td></tr>
              ) : rounds.map((r) => {
                const dur = r.started_at && r.crashed_at
                  ? ((new Date(r.crashed_at) - new Date(r.started_at)) / 1000).toFixed(1) + "s"
                  : "—";
                return (
                  <tr key={r.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: ".72rem" }}>{r.id.slice(0, 8).toUpperCase()}</td>
                    <td>
                      {r.crash_point
                        ? <span className={`history-chip ${chipClass(r.crash_point)}`}>{parseFloat(r.crash_point).toFixed(2)}×</span>
                        : "—"}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</td>
                    <td style={{ color: "var(--text-muted)" }}>{dur}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get("/auth/me/").then((r) => setProfile(r.data)).catch(() => {});
  }, []);

  if (!profile) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
      <span className="spin"><i className="bi bi-arrow-repeat" /></span>
    </div>
  );

  const stats = [
    { label: "Balance",      value: `KES ${parseFloat(profile.balance).toLocaleString()}`,    color: "var(--green)" },
    { label: "Total Wagered", value: `KES ${parseFloat(profile.total_wagered).toLocaleString()}`, color: "var(--text-primary)" },
    { label: "Total Won",    value: `KES ${parseFloat(profile.total_won).toLocaleString()}`,   color: "var(--accent2)" },
    { label: "Net P/L",      value: `KES ${parseFloat(profile.profit_loss).toLocaleString()}`,
      color: profile.profit_loss >= 0 ? "var(--green)" : "var(--red)" },
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 12px" }}>
      <div className="card-shabiki p-4 mb-4 text-center">
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "var(--bg-hover)", border: "2px solid var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px", fontSize: "1.8rem",
        }}>
          {profile.username[0].toUpperCase()}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {profile.username}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: ".82rem" }}>{profile.email}</div>
        {profile.is_staff && (
          <span className="badge-status badge-flying mt-2 d-inline-block">
            <i className="bi bi-shield-fill me-1" />ADMIN
          </span>
        )}
      </div>

      <div className="row g-3">
        {stats.map((s) => (
          <div key={s.label} className="col-6">
            <div className="card-shabiki p-3 text-center">
              <div style={{ color: "var(--text-muted)", fontSize: ".72rem", letterSpacing: 1, fontFamily: "var(--font-display)" }}>
                {s.label.toUpperCase()}
              </div>
              <div style={{ color: s.color, fontWeight: 700, fontSize: "1.1rem", marginTop: 4 }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card-shabiki p-3 mt-3">
        <div style={{ fontFamily: "var(--font-display)", fontSize: ".72rem", color: "var(--text-muted)", letterSpacing: 1, marginBottom: 12 }}>
          ACCOUNT DETAILS
        </div>
        {[
          ["Phone", profile.phone || "—"],
          ["Member Since", new Date(profile.created_at || Date.now()).toLocaleDateString()],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-muted)", fontSize: ".82rem" }}>{k}</span>
            <span style={{ color: "var(--text-primary)", fontSize: ".82rem" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HistoryPage;