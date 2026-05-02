import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../App";

export default function LiveChat({ socket, chatMessages = [], liveFeed = [] }) {
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const send = (e) => {
    e.preventDefault();
    const text = msg.trim();
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "chat.send", message: text }));
    setMsg("");
  };

  return (
    <div className="card-shabiki p-0 overflow-hidden" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {["Chat", "Live Feed"].map((tab, idx) => (
          <button
            key={tab}
            className="btn"
            id={`chat-tab-${idx}`}
            data-bs-toggle="tab"
            data-bs-target={`#chat-pane-${idx}`}
            type="button"
            role="tab"
            style={{
              flex: 1,
              border: "none",
              background: "none",
              color: idx === 0 ? "var(--accent)" : "var(--text-muted)",
              fontFamily: "var(--font-display)",
              fontSize: ".7rem",
              letterSpacing: 1,
              padding: ".5rem",
              borderBottom: idx === 0 ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tab-content flex-grow-1 overflow-hidden" style={{ display: "flex", flexDirection: "column" }}>
        {/* Chat pane */}
        <div className="tab-pane fade show active p-2" id="chat-pane-0" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="chat-container flex-grow-1 mb-2" style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {chatMessages.map((m, i) => (
              <div key={i} className="chat-msg">
                <span className="chat-username">{m.username}: </span>
                <span style={{ color: "var(--text-primary)" }}>{m.message}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={send} className="d-flex gap-1 mt-auto">
            <input
              className="form-control-shabiki flex-grow-1"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Say something..."
              maxLength={300}
              style={{ fontSize: ".82rem" }}
            />
            <button type="submit" className="btn btn-orange btn-sm px-2">
              <i className="bi bi-send-fill" />
            </button>
          </form>
        </div>

        {/* Live feed pane */}
        <div className="tab-pane fade p-2" id="chat-pane-1" style={{ flex: 1, overflowY: "auto" }}>
          {liveFeed.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: ".78rem", textAlign: "center", marginTop: 20 }}>
              Live plays will appear here
            </div>
          ) : (
            [...liveFeed].reverse().map((ev, i) => (
              <div key={i} className="live-feed-item">
                {ev.event === "cashout" ? (
                  <span>
                    <span style={{ color: "var(--accent2)", fontWeight: 600 }}>{ev.username}</span>
                    <span style={{ color: "var(--text-muted)" }}> cashed out </span>
                    <span style={{ color: "var(--green)", fontWeight: 700 }}>KES {parseFloat(ev.payout).toLocaleString()}</span>
                    <span style={{ color: "var(--text-muted)" }}> @ </span>
                    <span style={{ color: "var(--yellow)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{parseFloat(ev.multiplier).toFixed(2)}×</span>
                  </span>
                ) : ev.event === "bet" ? (
                  <span>
                    <span style={{ color: "var(--accent2)", fontWeight: 600 }}>{ev.username}</span>
                    <span style={{ color: "var(--text-muted)" }}> bet </span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>KES {parseFloat(ev.amount).toLocaleString()}</span>
                  </span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>{JSON.stringify(ev)}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}