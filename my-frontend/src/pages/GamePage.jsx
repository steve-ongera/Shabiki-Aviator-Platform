import React, { useEffect, useRef, useState, useCallback } from "react";
import { WS_URL } from "../utils/api";
import { useAuth, useFlash } from "../App";
import PlaneAnimation from "../components/PlaneAnimation";
import BetPanel       from "../components/BetPanel";
import PlayersList    from "../components/PlayersList";
import LiveChat       from "../components/LiveChat";
import api            from "../utils/api";

const MAX_HISTORY = 20;
const MAX_LIVE_FEED = 50;

export default function GamePage() {
  const { user } = useAuth();
  const { flash } = useFlash();
  const socketRef = useRef(null);

  const [status,      setStatus]      = useState("waiting");
  const [multiplier,  setMultiplier]  = useState("1.00");
  const [roundId,     setRoundId]     = useState(null);
  const [crashPoint,  setCrashPoint]  = useState(null);
  const [players,     setPlayers]     = useState([]);
  const [hasBet,      setHasBet]      = useState(false);
  const [history,     setHistory]     = useState([]);   // past round crash points
  const [chatMessages,setChatMessages] = useState([]);
  const [liveFeed,    setLiveFeed]    = useState([]);
  const [connected,   setConnected]   = useState(false);

  // ── History chips ──────────────────────────────────────────────────────────
  const chipClass = (v) => {
    const n = parseFloat(v);
    if (n < 2)   return "chip-low";
    if (n < 10)  return "chip-mid";
    if (n < 100) return "chip-high";
    return "chip-moon";
  };

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    const token = localStorage.getItem("access_token");
    const url   = `${WS_URL}/game/?token=${token}`;
    const ws    = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen  = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000); // auto-reconnect
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        handleWsMessage(msg);
      } catch {}
    };
  }, []);

  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case "game.state":
      case "game.betting":
        setStatus(msg.status || "betting");
        setMultiplier(msg.multiplier || "1.00");
        if (msg.round_id) setRoundId(msg.round_id);
        if (msg.players)  setPlayers(msg.players);
        if (msg.status === "betting" || msg.status === "waiting") {
          setHasBet(false);
          setCrashPoint(null);
        }
        break;

      case "game.tick":
        setStatus("flying");
        setMultiplier(msg.multiplier);
        break;

      case "game.crash":
        setStatus("crashed");
        setCrashPoint(msg.crash_point);
        setMultiplier(msg.crash_point);
        setHistory((h) => [msg.crash_point, ...h].slice(0, MAX_HISTORY));
        setPlayers((p) => p.map((pl) => pl.status === "placed" ? { ...pl, status: "lost" } : pl));
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
    api.get("/game/rounds/").then((r) => {
      setHistory(r.data.map((rnd) => rnd.crash_point).filter(Boolean));
    }).catch(() => {});
  }, []);

  return (
    <div style={{ padding: "12px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Connection indicator */}
      {!connected && (
        <div style={{ background: "#450a0a", border: "1px solid var(--red)", borderRadius: 8, padding: "8px 16px", marginBottom: 10, fontSize: ".82rem", color: "#fca5a5" }}>
          <span className="spin me-2"><i className="bi bi-arrow-repeat" /></span>
          Reconnecting to game server...
        </div>
      )}

      {/* History row */}
      <div className="mb-2" style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: ".7rem", marginRight: 4 }}>HISTORY</span>
        {history.map((cp, i) => (
          <span key={i} className={`history-chip ${chipClass(cp)}`}>
            {parseFloat(cp).toFixed(2)}×
          </span>
        ))}
      </div>

      {/* Main grid */}
      <div className="row g-2">
        {/* Left: canvas + bet panel */}
        <div className="col-12 col-lg-8">
          <PlaneAnimation
            status={status}
            multiplier={multiplier}
            crashPoint={crashPoint}
          />

          {/* Multiplier display below canvas */}
          <div className="d-flex align-items-center justify-content-between my-2 px-1">
            <div>
              <span
                className={`multiplier-value ${
                  status === "flying"  ? "multiplier-flying"  :
                  status === "crashed" ? "multiplier-crashed" :
                  status === "betting" ? "multiplier-betting" :
                  "multiplier-waiting"
                }`}
                style={{ fontSize: "2.8rem" }}
              >
                {status === "flying" || status === "crashed"
                  ? `${parseFloat(multiplier).toFixed(2)}×`
                  : status === "betting"
                  ? "BETTING..."
                  : "WAITING..."}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "var(--text-muted)", fontSize: ".7rem" }}>ROUND</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: ".75rem", color: "var(--accent2)" }}>
                {roundId ? `#${roundId.slice(0, 8).toUpperCase()}` : "—"}
              </div>
            </div>
          </div>

          <BetPanel
            status={status}
            roundId={roundId}
            hasBet={hasBet}
            onBetPlaced={() => setHasBet(true)}
            onCashout={() => setHasBet(false)}
            currentMultiplier={multiplier}
          />
        </div>

        {/* Right: players + chat */}
        <div className="col-12 col-lg-4 d-flex flex-column gap-2">
          <PlayersList players={players} />
          <div style={{ flex: 1, minHeight: 380 }}>
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