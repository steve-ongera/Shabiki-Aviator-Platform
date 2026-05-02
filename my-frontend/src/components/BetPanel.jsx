import React, { useState } from "react";
import api from "../utils/api";
import { useFlash } from "../App";

export default function BetPanel({ status, roundId, hasBet, onBetPlaced, onCashout, currentMultiplier }) {
  const { flash } = useFlash();
  const [amount, setAmount]           = useState("100");
  const [autoCashout, setAutoCashout] = useState("");
  const [loading, setLoading]         = useState(false);

  const quickAmounts = [50, 100, 200, 500, 1000];

  const placeBet = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      flash("Enter a valid bet amount.", "error");
      return;
    }
    setLoading(true);
    try {
      await api.post("/game/bet/", {
        amount: parseFloat(amount),
        auto_cashout: autoCashout ? parseFloat(autoCashout) : null,
      });
      flash(`Bet of KES ${amount} placed!`, "success");
      onBetPlaced();
    } catch (err) {
      flash(err.response?.data?.detail || "Bet failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const cashout = async () => {
    setLoading(true);
    try {
      const res = await api.post("/game/cashout/");
      flash(`Cashed out @ ${res.data.multiplier}× — KES ${res.data.payout}!`, "success");
      onCashout();
    } catch (err) {
      flash(err.response?.data?.detail || "Cashout failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const canBet     = status === "betting" && !hasBet;
  const canCashout = status === "flying"  && hasBet;

  return (
    <div className="card-shabiki p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <span style={{ fontFamily: "var(--font-display)", fontSize: ".75rem", color: "var(--text-muted)", letterSpacing: 1 }}>
          PLACE BET
        </span>
        {hasBet && (
          <span className="badge-status badge-betting" style={{ padding: "3px 10px" }}>
            <i className="bi bi-circle-fill me-1" style={{ fontSize: ".5rem" }} />
            BET ACTIVE
          </span>
        )}
      </div>

      {/* Amount input */}
      <div className="mb-2">
        <label style={{ color: "var(--text-muted)", fontSize: ".75rem", marginBottom: 4 }}>
          Amount (KES)
        </label>
        <input
          type="number"
          className="form-control-shabiki w-100"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          min="10"
          disabled={!canBet}
          style={{ fontSize: "1.1rem", fontWeight: 600 }}
        />
      </div>

      {/* Quick amounts */}
      <div className="d-flex gap-1 flex-wrap mb-3">
        {quickAmounts.map((q) => (
          <button
            key={q}
            className="btn-ghost btn btn-sm"
            onClick={() => setAmount(String(q))}
            disabled={!canBet}
            style={{ fontSize: ".72rem", padding: "2px 8px" }}
          >
            {q}
          </button>
        ))}
        <button
          className="btn-ghost btn btn-sm"
          onClick={() => setAmount((v) => String(parseFloat(v || 0) * 2))}
          disabled={!canBet}
          style={{ fontSize: ".72rem", padding: "2px 8px" }}
        >
          ×2
        </button>
        <button
          className="btn-ghost btn btn-sm"
          onClick={() => setAmount((v) => String(parseFloat(v || 0) / 2))}
          disabled={!canBet}
          style={{ fontSize: ".72rem", padding: "2px 8px" }}
        >
          ½
        </button>
      </div>

      {/* Auto cashout */}
      <div className="mb-3">
        <label style={{ color: "var(--text-muted)", fontSize: ".75rem", marginBottom: 4 }}>
          Auto Cash-Out (×) <span style={{ color: "var(--text-dim)" }}>optional</span>
        </label>
        <input
          type="number"
          className="form-control-shabiki w-100"
          value={autoCashout}
          onChange={(e) => setAutoCashout(e.target.value)}
          placeholder="e.g. 2.00"
          step="0.01"
          min="1.01"
          disabled={!canBet}
        />
      </div>

      {/* Action button */}
      {canCashout ? (
        <button
          className="btn btn-cyan w-100 py-2"
          onClick={cashout}
          disabled={loading}
          style={{ fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: 1 }}
        >
          {loading ? <span className="spin"><i className="bi bi-arrow-repeat" /></span> : (
            <>
              CASH OUT &nbsp;
              <span style={{ color: "#fff", fontWeight: 900 }}>
                {parseFloat(currentMultiplier || 1).toFixed(2)}×
              </span>
            </>
          )}
        </button>
      ) : (
        <button
          className="btn btn-orange w-100 py-2"
          onClick={placeBet}
          disabled={!canBet || loading}
          style={{ fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: 1 }}
        >
          {loading ? (
            <span className="spin"><i className="bi bi-arrow-repeat" /></span>
          ) : canBet ? (
            "PLACE BET"
          ) : status === "flying" && !hasBet ? (
            "WAIT FOR NEXT ROUND"
          ) : status === "flying" && hasBet ? (
            "BET PLACED — FLYING!"
          ) : status === "crashed" ? (
            "ROUND OVER"
          ) : (
            "WAITING..."
          )}
        </button>
      )}

      {status === "betting" && !hasBet && (
        <p style={{ color: "var(--text-muted)", fontSize: ".72rem", textAlign: "center", marginTop: 8, marginBottom: 0 }}>
          <i className="bi bi-info-circle me-1" />
          Place your bet before takeoff
        </p>
      )}
    </div>
  );
}