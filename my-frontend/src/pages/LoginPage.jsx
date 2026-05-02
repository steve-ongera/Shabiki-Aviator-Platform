import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../utils/api";
import { useAuth, useFlash } from "../App";

function AuthCard({ children, title, sub }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "radial-gradient(ellipse at 50% 0%, #0f1e38 0%, var(--bg-deep) 60%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 900, color: "var(--accent)" }}>
            ✈ SHABIKI
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: ".85rem", marginTop: 4 }}>
            Aviator Platform
          </div>
        </div>
        <div className="card-shabiki p-4">
          <h5 style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)", marginBottom: 4, fontSize: "1rem" }}>
            {title}
          </h5>
          {sub && <p style={{ color: "var(--text-muted)", fontSize: ".82rem", marginBottom: 20 }}>{sub}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const { flash } = useFlash();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || "/game";

  const [form, setForm]       = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login/", form);
      login(data.access, data.refresh);
      navigate(from, { replace: true });
    } catch (err) {
      flash(err.response?.data?.detail || "Invalid credentials.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Welcome back" sub="Sign in to your account">
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label style={{ color: "var(--text-muted)", fontSize: ".78rem", display: "block", marginBottom: 4 }}>
            Username
          </label>
          <input
            className="form-control-shabiki w-100"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            autoFocus
          />
        </div>
        <div className="mb-4">
          <label style={{ color: "var(--text-muted)", fontSize: ".78rem", display: "block", marginBottom: 4 }}>
            Password
          </label>
          <input
            type="password"
            className="form-control-shabiki w-100"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <button
          type="submit"
          className="btn btn-orange w-100 py-2"
          disabled={loading}
          style={{ fontFamily: "var(--font-display)", letterSpacing: 1 }}
        >
          {loading ? <span className="spin"><i className="bi bi-arrow-repeat" /></span> : "SIGN IN"}
        </button>
      </form>
      <p style={{ color: "var(--text-muted)", fontSize: ".8rem", textAlign: "center", marginTop: 20, marginBottom: 0 }}>
        New here? <Link to="/register">Create account</Link>
      </p>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { flash } = useFlash();
  const navigate  = useNavigate();

  const [form, setForm]       = useState({ username: "", email: "", phone: "", password: "", password2: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.password2) {
      flash("Passwords don't match.", "error");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register/", form);
      flash("Account created! Please sign in.", "success");
      navigate("/login");
    } catch (err) {
      const errors = err.response?.data;
      if (errors) {
        Object.values(errors).forEach((msgs) =>
          flash(Array.isArray(msgs) ? msgs[0] : msgs, "error")
        );
      } else {
        flash("Registration failed.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Create account" sub="Join Shabiki Aviator">
      <form onSubmit={handleSubmit}>
        {[
          ["username", "Username", "text"],
          ["email",    "Email",    "email"],
          ["phone",    "Phone (e.g. 0712345678)", "tel"],
          ["password",  "Password",        "password"],
          ["password2", "Confirm Password", "password"],
        ].map(([key, label, type]) => (
          <div key={key} className="mb-3">
            <label style={{ color: "var(--text-muted)", fontSize: ".78rem", display: "block", marginBottom: 4 }}>
              {label}
            </label>
            <input
              type={type}
              className="form-control-shabiki w-100"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              required={key !== "phone"}
            />
          </div>
        ))}
        <button
          type="submit"
          className="btn btn-orange w-100 py-2 mt-1"
          disabled={loading}
          style={{ fontFamily: "var(--font-display)", letterSpacing: 1 }}
        >
          {loading ? <span className="spin"><i className="bi bi-arrow-repeat" /></span> : "CREATE ACCOUNT"}
        </button>
      </form>
      <p style={{ color: "var(--text-muted)", fontSize: ".8rem", textAlign: "center", marginTop: 20, marginBottom: 0 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthCard>
  );
}

export default LoginPage;