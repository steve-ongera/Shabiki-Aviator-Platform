import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import api from "../../utils/api";

// ── Shared Admin Layout sidebar ───────────────────────────────────────────────
export function AdminLayout({ children }) {
  const links = [
    { to: "/admin-panel",              icon: "bi-speedometer2",   label: "Dashboard" },
    { to: "/admin-panel/users",        icon: "bi-people-fill",    label: "Users" },
    { to: "/admin-panel/games",        icon: "bi-controller",     label: "Games" },
    { to: "/admin-panel/transactions", icon: "bi-arrow-left-right", label: "Transactions" },
    { to: "/admin-panel/settings",     icon: "bi-gear-fill",      label: "Settings" },
  ];

  const navStyle = ({ isActive }) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 8,
    color: isActive ? "var(--accent)" : "var(--text-muted)",
    background: isActive ? "var(--bg-hover)" : "transparent",
    textDecoration: "none",
    fontSize: ".84rem",
    fontWeight: isActive ? 600 : 400,
    transition: "color .15s, background .15s",
  });

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 56px)" }}>
      {/* Sidebar */}
      <aside style={{
        width: 200, flexShrink: 0, background: "var(--bg-card)",
        borderRight: "1px solid var(--border)", padding: "16px 8px",
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: ".65rem", color: "var(--text-dim)", letterSpacing: 2, padding: "0 12px 12px" }}>
          ADMIN PANEL
        </div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === "/admin-panel"} style={navStyle}>
            <i className={`bi ${l.icon}`} />
            {l.label}
          </NavLink>
        ))}
      </aside>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = "var(--text-primary)", sub }) {
  return (
    <div className="card-shabiki p-3">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: ".7rem", letterSpacing: 1, fontFamily: "var(--font-display)" }}>
            {label.toUpperCase()}
          </div>
          <div style={{ color, fontSize: "1.4rem", fontWeight: 700, marginTop: 4 }}>
            {value}
          </div>
          {sub && <div style={{ color: "var(--text-muted)", fontSize: ".72rem", marginTop: 2 }}>{sub}</div>}
        </div>
        <i className={`bi ${icon}`} style={{ fontSize: "1.4rem", color: "var(--border)", marginTop: 2 }} />
      </div>
    </div>
  );
}

// ── Dashboard page ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get("/admin-panel/stats/")
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  const fmt = (v) => parseFloat(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 });

  return (
    <AdminLayout>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>
          DASHBOARD
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <i className="bi bi-arrow-repeat me-1" />Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <span className="spin"><i className="bi bi-arrow-repeat" /></span>
        </div>
      ) : !stats ? (
        <div style={{ color: "var(--red)" }}>Failed to load stats.</div>
      ) : (
        <div className="row g-3">
          <div className="col-6 col-lg-3">
            <StatCard icon="bi-people-fill"       label="Total Users"    value={stats.total_users} color="var(--accent2)" />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard icon="bi-person-check-fill" label="Active Today"   value={stats.active_users_today} color="var(--green)" />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard icon="bi-controller"        label="Rounds Today"   value={stats.rounds_today} color="var(--yellow)" />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard icon="bi-graph-up-arrow"    label="House Profit"
              value={`KES ${fmt(stats.house_profit)}`}
              color={parseFloat(stats.house_profit) >= 0 ? "var(--green)" : "var(--red)"} />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard icon="bi-cash-stack"        label="Total Deposited"  value={`KES ${fmt(stats.total_deposited)}`} />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard icon="bi-arrow-up-circle"   label="Total Withdrawn"  value={`KES ${fmt(stats.total_withdrawn)}`} />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard icon="bi-dice-6-fill"       label="Total Wagered"    value={`KES ${fmt(stats.total_wagered)}`} />
          </div>
          <div className="col-6 col-lg-3">
            <StatCard icon="bi-trophy-fill"       label="Total Paid Out"   value={`KES ${fmt(stats.total_won)}`} color="var(--accent)" />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}