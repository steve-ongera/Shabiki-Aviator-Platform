import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { DEV_MODE } from "../utils/api";
import api from "../utils/api";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.get("/wallet/balance/").then((r) => setBalance(r.data.balance)).catch(() => {});
    const iv = setInterval(() => {
      api.get("/wallet/balance/").then((r) => setBalance(r.data.balance)).catch(() => {});
    }, 8000);
    return () => clearInterval(iv);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navStyle = ({ isActive }) => ({
    color: isActive ? "var(--accent)" : "var(--text-muted)",
    fontWeight: isActive ? 600 : 400,
    textDecoration: "none",
    fontSize: ".88rem",
    transition: "color .15s",
  });

  return (
    <nav className="navbar-shabiki d-flex align-items-center justify-content-between flex-wrap gap-2">
      {/* Brand */}
      <div className="d-flex align-items-center gap-2">
        <Link to="/game" className="navbar-brand-text">
          ✈ SHABIKI
        </Link>
        {DEV_MODE && <span className="dev-badge">DEV</span>}
      </div>

      {/* Nav links */}
      <div className="d-flex align-items-center gap-3">
        <NavLink to="/game"    style={navStyle}>Game</NavLink>
        <NavLink to="/wallet"  style={navStyle}>Wallet</NavLink>
        <NavLink to="/history" style={navStyle}>History</NavLink>
        {user?.is_staff && (
          <NavLink to="/admin-panel" style={navStyle}>
            <i className="bi bi-shield-fill me-1" />Admin
          </NavLink>
        )}
      </div>

      {/* Right side */}
      <div className="d-flex align-items-center gap-2">
        {balance !== null && (
          <span className="nav-balance">
            <i className="bi bi-wallet2 me-1" />
            KES {parseFloat(balance).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
          </span>
        )}
        <NavLink to="/profile" style={navStyle}>
          <i className="bi bi-person-circle" style={{ fontSize: "1.1rem" }} />
        </NavLink>
        <button className="btn-ghost btn btn-sm" onClick={handleLogout}>
          <i className="bi bi-box-arrow-right" />
        </button>
      </div>
    </nav>
  );
}