// pages/GamePage.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { WS_URL } from "../utils/api";
import { useAuth, useFlash } from "../App";
import PlaneAnimation    from "../components/PlaneAnimation";
import BetPanel          from "../components/BetPanel";
import MultiplierDisplay from "../components/MultiplierDisplay";
import PlayersList       from "../components/PlayersList";
import LiveChat          from "../components/LiveChat";
import api               from "../utils/api";

const MAX_HISTORY  = 20;
const MAX_LIVE_FEED = 50;

// crash value → chip CSS class
const chipClass = (v) => {
  const n = parseFloat(v);
  if (n < 2)   return "history-chip chip-low";
  if (n < 10)  return "history-chip chip-mid";
  if (n < 100) return "history-chip chip-high";
  return "history-chip chip-moon";
};

export default function GamePage() {
  const { user }  = useAuth();
  const { flash } = useFlash();
  const socketRef  = useRef(null);

  const [status,       setStatus]       = useState("waiting");
  const [multiplier,   setMultiplier]   = useState(1.0);
  const [roundId,      setRoundId]      = useState(null);
  const [crashPoint,   setCrashPoint]   = useState(null);
  const [players,      setPlayers]      = useState([]);
  const [hasBet,       setHasBet]       = useState(false);
  const [history,      setHistory]      = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [liveFeed,     setLiveFeed]     = useState([]);
  const [connected,    setConnected]    = useState(false);

  // ── WebSocket ──────────────────────────────────────────────
  const connect = useCallback(() => {
    const token = localStorage.getItem("access_token");
    const ws    = new WebSocket(`${WS_URL}/game/?token=${token}`);
    socketRef.current = ws;

    ws.onopen  = () => setConnected(true);
    ws.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
    ws.onerror = () => ws.close();
    ws.onmessage = (evt) => {
      try { handleWsMessage(JSON.parse(evt.data)); } catch {}
    };
  }, []); // eslint-disable-line

  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case "game.state":
      case "game.betting":
        setStatus(msg.status || "betting");
        setMultiplier(parseFloat(msg.multiplier) || 1.0);
        if (msg.round_id) setRoundId(msg.round_id);
        if (msg.players)  setPlayers(msg.players);
        if (msg.status === "betting" || msg.status === "waiting") {
          setHasBet(false);
          setCrashPoint(null);
        }
        break;

      case "game.tick":
        setStatus("flying");
        setMultiplier(parseFloat(msg.multiplier));
        break;

      case "game.crash":
        setStatus("crashed");
        setCrashPoint(parseFloat(msg.crash_point));
        setMultiplier(parseFloat(msg.crash_point));
        setHistory((h) => [msg.crash_point, ...h].slice(0, MAX_HISTORY));
        setPlayers((p) =>
          p.map((pl) => pl.status === "placed" ? { ...pl, status: "lost" } : pl)
        );
        break;

      case "players.update":
        setPlayers(msg.players || []);
        break;

      case "bet.result":
        if (msg.won) {
          flash(`🎉 You won KES ${parseFloat(msg.payout).toLocaleString()} @ ${msg.multiplier}×`, "success");
        } else {
          flash(`💸 Flew away at ${msg.multiplier}×. Better luck next round!`, "error");
        }
        setHasBet(false);
        break;

      case "chat.history":
        setChatMessages(msg.messages || []);
        break;

      case "chat.message":
        setChatMessages((c) => [...c, { username: msg.username, message: msg.message }].slice(-100));
        break;

      case "live.play":
        setLiveFeed((f) => [...f, msg].slice(-MAX_LIVE_FEED));
        if (msg.event === "cashout") {
          setPlayers((p) =>
            p.map((pl) =>
              pl.username === msg.username
                ? { ...pl, status: "won", cashout: msg.multiplier }
                : pl
            )
          );
        }
        break;
    }
  }, [flash]);

  useEffect(() => {
    connect();
    return () => socketRef.current?.close();
  }, [connect]);

  // Load recent history on mount
  useEffect(() => {
    api.get("/game/rounds/")
      .then((r) => setHistory(r.data.map((rnd) => rnd.crash_point).filter(Boolean)))
      .catch(() => {});
  }, []);

  return (
    <div className="container-shabiki" style={{ padding: "12px 16px" }}>

      {/* ── Reconnecting banner ── */}
      {!connected && (
        <div className="reconnect-bar">
          <span className="spin">↻</span>
          Reconnecting to game server…
        </div>
      )}

      {/* ── History chips ── */}
      <div
        className="d-flex align-items-center mb-2 history-row"
        style={{ gap: 6, paddingBottom: 2 }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: ".58rem",
            letterSpacing: ".14em",
            color: "var(--text-dim)",
            flexShrink: 0,
          }}
        >
          HISTORY
        </span>
        {history.map((cp, i) => (
          <span key={i} className={chipClass(cp)}>
            {parseFloat(cp).toFixed(2)}×
          </span>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="row g-2 game-main-grid">

        {/* Left column — canvas + multiplier + bet panel */}
        <div className="col-12 col-lg-8" style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Plane canvas */}
          <div className="plane-canvas-wrap">
            <PlaneAnimation
              status={status}
              multiplier={multiplier}
              crashPoint={crashPoint}
            />
          </div>

          {/* Multiplier + round ID row */}
          <div
            className="d-flex align-items-center justify-content-between"
            style={{ padding: "0 4px" }}
          >
            <MultiplierDisplay
              multiplier={multiplier}
              phase={status}
              crashPoint={crashPoint}
            />

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: ".58rem",
                  letterSpacing: ".14em",
                  color: "var(--text-dim)",
                }}
              >
                ROUND
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: ".72rem",
                  color: "var(--accent2)",
                  marginTop: 3,
                }}
              >
                {roundId ? `#${roundId.toString().slice(0, 8).toUpperCase()}` : "—"}
              </div>
            </div>
          </div>

          {/* Bet panel */}
          <BetPanel
            status={status}
            roundId={roundId}
            hasBet={hasBet}
            onBetPlaced={() => setHasBet(true)}
            onCashout={() => setHasBet(false)}
            currentMultiplier={multiplier}
          />
        </div>

        {/* Right column — players + chat */}
        <div
          className="col-12 col-lg-4"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div className="card-shabiki">
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                fontFamily: "var(--font-display)",
                fontSize: ".62rem",
                letterSpacing: ".12em",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>PLAYERS THIS ROUND</span>
              <span style={{ color: "var(--accent2)" }}>{players.length}</span>
            </div>
            <PlayersList players={players} />
          </div>

          <div style={{ flex: 1, minHeight: 320 }}>
            <LiveChat
              socket={socketRef.current}
              chatMessages={chatMessages}
              liveFeed={liveFeed}
            />
          </div>
        </div>
      </div>
    </div>
  );
}