import React from "react";

export default function PlayersList({ players = [] }) {
  const sorted = [...players].sort((a, b) => {
    if (a.status === "won" && b.status !== "won") return -1;
    if (b.status === "won" && a.status !== "won") return 1;
    return parseFloat(b.bet || 0) - parseFloat(a.bet || 0);
  });

  return (
    <div className="card-shabiki p-3" style={{ height: "100%", minHeight: 200 }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span style={{ fontFamily: "var(--font-display)", fontSize: ".75rem", color: "var(--text-muted)", letterSpacing: 1 }}>
          LIVE PLAYERS
        </span>
        <span style={{ color: "var(--accent2)", fontSize: ".75rem", fontWeight: 600 }}>
          {players.length}
        </span>
      </div>

      {players.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: ".8rem", textAlign: "center", padding: "24px 0" }}>
          No bets this round yet
        </div>
      ) : (
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {sorted.map((p, i) => (
            <div
              key={`${p.username}-${i}`}
              className={`player-row ${p.status}`}
            >
              <div className="d-flex align-items-center gap-2">
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "var(--bg-hover)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: ".7rem",
                    color: "var(--accent2)",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {p.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div style={{ fontSize: ".8rem", color: "var(--text-primary)", lineHeight: 1.2 }}>
                    {p.username}
                  </div>
                  <div style={{ fontSize: ".7rem", color: "var(--text-muted)" }}>
                    KES {parseFloat(p.bet || 0).toLocaleString()}
                    {p.auto_cashout && (
                      <span style={{ color: "var(--yellow)", marginLeft: 4 }}>
                        🎯{p.auto_cashout}×
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="cashout-badge">
                {p.status === "won" && p.cashout && (
                  <span style={{ color: "var(--green)" }}>
                    {parseFloat(p.cashout).toFixed(2)}×
                  </span>
                )}
                {p.status === "lost" && (
                  <span style={{ color: "var(--red)", opacity: .7 }}>✗</span>
                )}
                {p.status === "placed" && (
                  <span style={{ color: "var(--accent2)" }}>
                    <i className="bi bi-circle-fill" style={{ fontSize: ".45rem" }} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}