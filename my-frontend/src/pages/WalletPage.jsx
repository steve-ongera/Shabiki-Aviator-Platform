import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { DEV_MODE } from "../utils/api";
import { useFlash } from "../App";

export default function WalletPage() {
  const { flash }   = useFlash();
  const [balance, setBalance]   = useState(null);
  const [tab, setTab]           = useState("deposit");
  const [loading, setLoading]   = useState(false);
  const [txs, setTxs]           = useState([]);

  // Deposit state
  const [depPhone,  setDepPhone]  = useState("");
  const [depAmount, setDepAmount] = useState("500");
  const [devAmount, setDevAmount] = useState("1000");

  // Withdraw state
  const [wMethod, setWMethod]   = useState("mpesa");
  const [wPhone,  setWPhone]    = useState("");
  const [wEmail,  setWEmail]    = useState("");
  const [wAmount, setWAmount]   = useState("500");

  const loadBalance = () =>
    api.get("/wallet/balance/").then((r) => setBalance(r.data.balance)).catch(() => {});
  const loadTxs = () =>
    api.get("/transactions/").then((r) => setTxs(r.data)).catch(() => {});

  useEffect(() => { loadBalance(); loadTxs(); }, []);

  const handleMpesaDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/wallet/deposit/mpesa/", { phone: depPhone, amount: parseFloat(depAmount) });
      flash(res.data.detail, "info");
      // Poll status
      const txId = res.data.transaction_id;
      let tries = 0;
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

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 12px" }}>
      {/* Balance header */}
      <div className="card-shabiki p-4 mb-4 text-center">
        <div style={{ color: "var(--text-muted)", fontSize: ".75rem", letterSpacing: 1, fontFamily: "var(--font-display)" }}>
          WALLET BALANCE
        </div>
        <div style={{ fontSize: "2.5rem", fontFamily: "var(--font-display)", fontWeight: 900, color: "var(--green)", marginTop: 4 }}>
          KES {balance !== null ? parseFloat(balance).toLocaleString("en-KE", { minimumFractionDigits: 2 }) : "—"}
        </div>
        {DEV_MODE && (
          <div style={{ marginTop: 8 }}>
            <span className="dev-badge">DEV MODE — No real money</span>
          </div>
        )}
      </div>

      <div className="row g-3">
        {/* Deposit / Withdraw tabs */}
        <div className="col-12 col-md-6">
          <div className="card-shabiki p-3">
            {/* Tab buttons */}
            <div className="d-flex mb-3 gap-1">
              {["deposit", "withdraw"].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "btn btn-orange btn-sm flex-grow-1" : "btn btn-ghost btn-sm flex-grow-1"}
                  onClick={() => setTab(t)}
                  style={{ textTransform: "capitalize", fontFamily: "var(--font-display)", fontSize: ".72rem", letterSpacing: 1 }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Deposit */}
            {tab === "deposit" && (
              <>
                {DEV_MODE && (
                  <form onSubmit={handleDevDeposit} className="mb-4">
                    <div className="p-3 mb-3" style={{ background: "#713f1222", border: "1px solid #713f12", borderRadius: 8 }}>
                      <div style={{ color: "#fde68a", fontWeight: 700, fontSize: ".8rem", marginBottom: 6 }}>
                        ⚡ Dev Instant Deposit
                      </div>
                      <input
                        className="form-control-shabiki w-100 mb-2"
                        type="number"
                        value={devAmount}
                        onChange={(e) => setDevAmount(e.target.value)}
                        min="1"
                      />
                      <button className="btn btn-orange w-100" type="submit" disabled={loading}
                        style={{ fontFamily: "var(--font-display)", fontSize: ".8rem" }}>
                        {loading ? <span className="spin"><i className="bi bi-arrow-repeat" /></span> : "ADD FUNDS (DEV)"}
                      </button>
                    </div>
                    <hr className="divider" />
                  </form>
                )}
                <form onSubmit={handleMpesaDeposit}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/M-PESA_LOGO-01.svg/200px-M-PESA_LOGO-01.svg.png"
                      alt="M-Pesa" style={{ height: 22, filter: "brightness(1.2)" }} />
                    <span style={{ fontFamily: "var(--font-display)", fontSize: ".72rem", color: "var(--text-muted)", letterSpacing: 1 }}>
                      STK PUSH
                    </span>
                  </div>
                  <div className="mb-3">
                    <label style={{ color: "var(--text-muted)", fontSize: ".75rem", display: "block", marginBottom: 4 }}>
                      Safaricom Number
                    </label>
                    <input className="form-control-shabiki w-100" value={depPhone}
                      onChange={(e) => setDepPhone(e.target.value)} placeholder="0712345678" required />
                  </div>
                  <div className="mb-3">
                    <label style={{ color: "var(--text-muted)", fontSize: ".75rem", display: "block", marginBottom: 4 }}>
                      Amount (KES)
                    </label>
                    <input className="form-control-shabiki w-100" type="number"
                      value={depAmount} onChange={(e) => setDepAmount(e.target.value)} min="10" required />
                  </div>
                  <button className="btn btn-orange w-100 py-2" type="submit" disabled={loading}
                    style={{ fontFamily: "var(--font-display)", letterSpacing: 1 }}>
                    {loading ? <span className="spin"><i className="bi bi-arrow-repeat" /></span> : "DEPOSIT VIA M-PESA"}
                  </button>
                  <p style={{ color: "var(--text-muted)", fontSize: ".72rem", marginTop: 8, marginBottom: 0 }}>
                    You'll receive a prompt on your phone. Enter your PIN to confirm.
                  </p>
                </form>
              </>
            )}

            {/* Withdraw */}
            {tab === "withdraw" && (
              <form onSubmit={handleWithdraw}>
                <div className="d-flex gap-1 mb-3">
                  {["mpesa", "paypal"].map((m) => (
                    <button key={m} type="button"
                      className={wMethod === m ? "btn btn-orange btn-sm flex-grow-1" : "btn btn-ghost btn-sm flex-grow-1"}
                      onClick={() => setWMethod(m)}
                      style={{ textTransform: "uppercase", fontFamily: "var(--font-display)", fontSize: ".7rem", letterSpacing: 1 }}>
                      {m}
                    </button>
                  ))}
                </div>

                {wMethod === "mpesa" ? (
                  <div className="mb-3">
                    <label style={{ color: "var(--text-muted)", fontSize: ".75rem", display: "block", marginBottom: 4 }}>Phone</label>
                    <input className="form-control-shabiki w-100" value={wPhone}
                      onChange={(e) => setWPhone(e.target.value)} placeholder="0712345678" required />
                  </div>
                ) : (
                  <div className="mb-3">
                    <label style={{ color: "var(--text-muted)", fontSize: ".75rem", display: "block", marginBottom: 4 }}>PayPal Email</label>
                    <input className="form-control-shabiki w-100" type="email" value={wEmail}
                      onChange={(e) => setWEmail(e.target.value)} placeholder="you@example.com" required />
                  </div>
                )}

                <div className="mb-3">
                  <label style={{ color: "var(--text-muted)", fontSize: ".75rem", display: "block", marginBottom: 4 }}>Amount (KES)</label>
                  <input className="form-control-shabiki w-100" type="number"
                    value={wAmount} onChange={(e) => setWAmount(e.target.value)} min="10" required />
                </div>
                <button className="btn btn-cyan w-100 py-2" type="submit" disabled={loading}
                  style={{ fontFamily: "var(--font-display)", letterSpacing: 1 }}>
                  {loading ? <span className="spin"><i className="bi bi-arrow-repeat" /></span> : `WITHDRAW VIA ${wMethod.toUpperCase()}`}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Transaction history */}
        <div className="col-12 col-md-6">
          <div className="card-shabiki p-3">
            <div style={{ fontFamily: "var(--font-display)", fontSize: ".75rem", color: "var(--text-muted)", letterSpacing: 1, marginBottom: 12 }}>
              RECENT TRANSACTIONS
            </div>
            {txs.length === 0 ? (
              <div style={{ color: "var(--text-dim)", textAlign: "center", padding: "30px 0", fontSize: ".85rem" }}>
                No transactions yet
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {txs.map((tx) => (
                  <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: ".82rem", textTransform: "capitalize", color: "var(--text-primary)" }}>
                        {tx.type}
                        <span style={{ color: "var(--text-muted)", marginLeft: 6, fontSize: ".72rem" }}>via {tx.method}</span>
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: ".7rem" }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontWeight: 700,
                        color: tx.type === "deposit" || tx.type === "win" ? "var(--green)" : "var(--red)"
                      }}>
                        {tx.type === "deposit" || tx.type === "win" ? "+" : "-"}KES {parseFloat(tx.amount).toLocaleString()}
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