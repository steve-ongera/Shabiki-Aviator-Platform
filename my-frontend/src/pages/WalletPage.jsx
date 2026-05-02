// pages/WalletPage.jsx
import React, { useState, useEffect } from "react";
import api, { DEV_MODE } from "../utils/api";
import { useFlash } from "../App";

export default function WalletPage() {
  const { flash } = useFlash();

  const [balance,   setBalance]   = useState(null);
  const [tab,       setTab]       = useState("deposit");
  const [loading,   setLoading]   = useState(false);
  const [txs,       setTxs]       = useState([]);

  // Deposit state
  const [depPhone,  setDepPhone]  = useState("");
  const [depAmount, setDepAmount] = useState("500");
  const [devAmount, setDevAmount] = useState("1000");

  // Withdraw state
  const [wMethod, setWMethod] = useState("mpesa");
  const [wPhone,  setWPhone]  = useState("");
  const [wEmail,  setWEmail]  = useState("");
  const [wAmount, setWAmount] = useState("500");

  const loadBalance = () =>
    api.get("/wallet/balance/").then((r) => setBalance(r.data.balance)).catch(() => {});
  const loadTxs = () =>
    api.get("/transactions/").then((r) => setTxs(r.data)).catch(() => {});

  useEffect(() => { loadBalance(); loadTxs(); }, []);

  // ── Handlers ──────────────────────────────────────────────
  const handleMpesaDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/wallet/deposit/mpesa/", {
        phone: depPhone, amount: parseFloat(depAmount),
      });
      flash(res.data.detail, "info");
      const txId = res.data.transaction_id;
      let tries  = 0;
      const poll = setInterval(async () => {
        tries++;
        try {
          const s = await api.get(`/wallet/deposit/status/${txId}/`);
          if (s.data.status === "completed") {
            clearInterval(poll);
            flash("Deposit successful! Wallet credited.", "success");
            loadBalance(); loadTxs();
          } else if (s.data.status === "failed") {
            clearInterval(poll);
            flash("Deposit failed or cancelled.", "error");
          }
        } catch {}
        if (tries > 30) clearInterval(poll);
      }, 3000);
    } catch (err) {
      flash(err.response?.data?.detail || "Deposit failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDevDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/wallet/deposit/dev/", { amount: parseFloat(devAmount) });
      flash(res.data.detail, "success");
      loadBalance(); loadTxs();
    } catch (err) {
      flash(err.response?.data?.detail || "Dev deposit failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = wMethod === "mpesa" ? "/wallet/withdraw/mpesa/" : "/wallet/withdraw/paypal/";
      const payload  = wMethod === "mpesa"
        ? { phone: wPhone, amount: parseFloat(wAmount) }
        : { email: wEmail, amount: parseFloat(wAmount) };
      const res = await api.post(endpoint, payload);
      flash(res.data.detail, "success");
      loadBalance(); loadTxs();
    } catch (err) {
      flash(err.response?.data?.detail || "Withdrawal failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────
  const txSign  = (type) => (type === "deposit" || type === "win") ? "+" : "−";
  const txColor = (type) => (type === "deposit" || type === "win") ? "positive" : "negative";

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="container-shabiki" style={{ padding: "20px 16px", maxWidth: 960 }}>

      {/* ── Balance card ── */}
      <div className="wallet-balance-card mb-4">
        <div className="wallet-balance-label">WALLET BALANCE</div>
        <div className="wallet-balance-amount">
          {balance !== null
            ? `KES ${parseFloat(balance).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`
            : "KES —"}
        </div>
        {DEV_MODE && (
          <div style={{ marginTop: 12 }}>
            <span className="dev-badge">⚡ DEV MODE — No real money</span>
          </div>
        )}
      </div>

      <div className="row">

        {/* ── Deposit / Withdraw panel ── */}
        <div className="col-12 col-md-6">
          <div className="card-shabiki p-3">

            {/* Tab toggle */}
            <div className="d-flex mb-3" style={{ gap: 6 }}>
              {["deposit", "withdraw"].map((t) => (
                <button
                  key={t}
                  className={`wallet-tab-btn${tab === t ? " active" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t === "deposit" ? "↓ Deposit" : "↑ Withdraw"}
                </button>
              ))}
            </div>

            {/* ── DEPOSIT ── */}
            {tab === "deposit" && (
              <>
                {/* Dev bypass */}
                {DEV_MODE && (
                  <form onSubmit={handleDevDeposit}>
                    <div
                      style={{
                        background: "rgba(245,158,11,0.07)",
                        border: "1px solid rgba(245,158,11,0.25)",
                        borderRadius: "var(--radius-md)",
                        padding: "14px 16px",
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: ".65rem",
                          letterSpacing: ".1em",
                          color: "#fde68a",
                          marginBottom: 10,
                        }}
                      >
                        ⚡ DEV INSTANT DEPOSIT
                      </div>
                      <input
                        className="form-control-shabiki w-100"
                        type="number"
                        value={devAmount}
                        onChange={(e) => setDevAmount(e.target.value)}
                        min="1"
                        style={{ marginBottom: 10 }}
                      />
                      <button
                        className="btn btn-orange w-100"
                        type="submit"
                        disabled={loading}
                      >
                        {loading ? <span className="spin">↻</span> : "ADD FUNDS INSTANTLY"}
                      </button>
                    </div>
                    <hr className="divider" />
                  </form>
                )}

                {/* M-Pesa STK */}
                <form onSubmit={handleMpesaDeposit}>
                  <div className="d-flex align-items-center mb-3" style={{ gap: 10 }}>
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/M-PESA_LOGO-01.svg/200px-M-PESA_LOGO-01.svg.png"
                      alt="M-Pesa"
                      style={{ height: 22, filter: "brightness(1.2)" }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: ".6rem",
                        letterSpacing: ".12em",
                        color: "var(--text-muted)",
                      }}
                    >
                      STK PUSH
                    </span>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Safaricom Number</label>
                    <input
                      className="form-control-shabiki w-100"
                      value={depPhone}
                      onChange={(e) => setDepPhone(e.target.value)}
                      placeholder="0712 345 678"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Amount (KES)</label>
                    <input
                      className="form-control-shabiki w-100"
                      type="number"
                      value={depAmount}
                      onChange={(e) => setDepAmount(e.target.value)}
                      min="10"
                      required
                    />
                  </div>

                  <button
                    className="btn btn-orange w-100 btn-lg"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? <span className="spin">↻</span> : "DEPOSIT VIA M-PESA"}
                  </button>
                  <p
                    style={{
                      color: "var(--text-muted)",
                      fontSize: ".75rem",
                      marginTop: 10,
                    }}
                  >
                    A payment prompt will appear on your phone. Enter your M-Pesa PIN to confirm.
                  </p>
                </form>
              </>
            )}

            {/* ── WITHDRAW ── */}
            {tab === "withdraw" && (
              <form onSubmit={handleWithdraw}>

                {/* Method selector */}
                <div className="d-flex mb-3" style={{ gap: 6 }}>
                  {["mpesa", "paypal"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`payment-method-tab${wMethod === m ? " active" : ""}`}
                      onClick={() => setWMethod(m)}
                    >
                      {m === "mpesa" ? "📱 M-Pesa" : "🅿 PayPal"}
                    </button>
                  ))}
                </div>

                {wMethod === "mpesa" ? (
                  <div className="mb-3">
                    <label className="form-label">Safaricom Number</label>
                    <input
                      className="form-control-shabiki w-100"
                      value={wPhone}
                      onChange={(e) => setWPhone(e.target.value)}
                      placeholder="0712 345 678"
                      required
                    />
                  </div>
                ) : (
                  <div className="mb-3">
                    <label className="form-label">PayPal Email</label>
                    <input
                      className="form-control-shabiki w-100"
                      type="email"
                      value={wEmail}
                      onChange={(e) => setWEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label">Amount (KES)</label>
                  <input
                    className="form-control-shabiki w-100"
                    type="number"
                    value={wAmount}
                    onChange={(e) => setWAmount(e.target.value)}
                    min="10"
                    required
                  />
                </div>

                <button
                  className="btn btn-cyan w-100 btn-lg"
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? <span className="spin">↻</span>
                    : `WITHDRAW VIA ${wMethod.toUpperCase()}`}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Transaction history ── */}
        <div className="col-12 col-md-6">
          <div className="card-shabiki p-3">
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: ".62rem",
                letterSpacing: ".14em",
                color: "var(--text-muted)",
                marginBottom: 14,
              }}
            >
              RECENT TRANSACTIONS
            </div>

            {txs.length === 0 ? (
              <div
                style={{
                  color: "var(--text-dim)",
                  textAlign: "center",
                  padding: "36px 0",
                  fontSize: ".88rem",
                }}
              >
                No transactions yet
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {txs.map((tx) => (
                  <div key={tx.id} className="tx-row">
                    <div>
                      <div>
                        <span className="tx-type">{tx.type}</span>
                        <span className="tx-method">via {tx.method}</span>
                      </div>
                      <div className="tx-date">
                        {new Date(tx.created_at).toLocaleString("en-KE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className={`tx-amount ${txColor(tx.type)}`}>
                        {txSign(tx.type)}KES {parseFloat(tx.amount).toLocaleString()}
                      </div>
                      <span className={`badge-status badge-${tx.status}`}>{tx.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}