// components/MultiplierDisplay.jsx
import React, { useEffect, useRef, useState } from "react";

const PHASE_COLORS = {
  waiting:  { primary: "#94a3b8", glow: "rgba(148,163,184,0.3)" },
  betting:  { primary: "#facc15", glow: "rgba(250,204,21,0.35)" },
  flying:   { primary: "#22d3ee", glow: "rgba(34,211,238,0.4)"  },
  crashed:  { primary: "#ef4444", glow: "rgba(239,68,68,0.5)"   },
  cashedout:{ primary: "#4ade80", glow: "rgba(74,222,128,0.4)"  },
};

const PHASE_LABELS = {
  waiting:   "WAITING",
  betting:   "PLACE YOUR BET",
  flying:    "FLYING",
  crashed:   "CRASHED",
  cashedout: "CASHED OUT",
};

export default function MultiplierDisplay({ multiplier = 1.0, phase = "waiting", crashPoint = null }) {
  const prevMultiplier = useRef(multiplier);
  const [bump, setBump] = useState(false);
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.waiting;

  useEffect(() => {
    if (multiplier !== prevMultiplier.current && phase === "flying") {
      setBump(true);
      const t = setTimeout(() => setBump(false), 80);
      prevMultiplier.current = multiplier;
      return () => clearTimeout(t);
    }
    prevMultiplier.current = multiplier;
  }, [multiplier, phase]);

  const displayValue = phase === "crashed" && crashPoint != null
    ? crashPoint.toFixed(2)
    : typeof multiplier === "number"
    ? multiplier.toFixed(2)
    : "1.00";

  return (
    <div style={styles.wrapper}>
      {/* Radial pulse rings */}
      {phase === "flying" && (
        <>
          <div style={{ ...styles.ring, animationDelay: "0s",   borderColor: colors.primary + "33" }} />
          <div style={{ ...styles.ring, animationDelay: "0.6s", borderColor: colors.primary + "22" }} />
          <div style={{ ...styles.ring, animationDelay: "1.2s", borderColor: colors.primary + "11" }} />
        </>
      )}

      {/* Main card */}
      <div
        style={{
          ...styles.card,
          boxShadow: `0 0 60px ${colors.glow}, 0 0 120px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
          border: `1px solid ${colors.primary}44`,
          transform: bump ? "scale(1.04)" : "scale(1)",
          transition: "transform 0.08s cubic-bezier(.17,.67,.83,.67), box-shadow 0.4s ease, border-color 0.4s ease",
        }}
      >
        {/* Phase label */}
        <div style={{ ...styles.phaseLabel, color: colors.primary, textShadow: `0 0 12px ${colors.primary}` }}>
          {PHASE_LABELS[phase] || phase.toUpperCase()}
        </div>

        {/* Multiplier number */}
        <div
          style={{
            ...styles.multiplier,
            color: colors.primary,
            textShadow: `0 0 30px ${colors.primary}, 0 0 60px ${colors.glow}`,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: phase === "crashed" ? "-2px" : "0px",
          }}
        >
          {displayValue}
          <span style={styles.x}>×</span>
        </div>

        {/* Bottom decoration */}
        <div style={{ ...styles.scanline, background: `linear-gradient(90deg, transparent, ${colors.primary}44, transparent)` }} />
      </div>

      {/* Corner tick marks */}
      {["tl","tr","bl","br"].map((pos) => (
        <div key={pos} style={{ ...styles.tick, ...styles[`tick_${pos}`], borderColor: colors.primary + "99" }} />
      ))}

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.8; }
          100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
        }
        @keyframes scanline-sweep {
          0%   { opacity: 0.6; left: -100%; }
          100% { opacity: 0;   left: 200%;  }
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 180,
    userSelect: "none",
  },
  ring: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 220,
    height: 220,
    borderRadius: "50%",
    border: "1px solid",
    animation: "pulse-ring 1.8s ease-out infinite",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    background: "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(7,11,22,0.98))",
    borderRadius: 20,
    padding: "28px 48px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    minWidth: 240,
    overflow: "hidden",
    zIndex: 1,
  },
  phaseLabel: {
    fontFamily: "'Courier New', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    opacity: 0.85,
  },
  multiplier: {
    fontFamily: "'Georgia', serif",
    fontSize: 72,
    fontWeight: 900,
    lineHeight: 1,
    display: "flex",
    alignItems: "flex-start",
  },
  x: {
    fontSize: 36,
    lineHeight: 1.2,
    marginTop: 8,
    opacity: 0.7,
  },
  scanline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    animation: "scanline-sweep 3s ease-in-out infinite",
  },
  // Corner ticks
  tick: {
    position: "absolute",
    width: 16,
    height: 16,
    borderWidth: "2px 0 0 2px",
    borderStyle: "solid",
    transition: "border-color 0.4s ease",
  },
  tick_tl: { top: 8,  left: 8,  borderRadius: "4px 0 0 0" },
  tick_tr: { top: 8,  right: 8, borderWidth: "2px 2px 0 0", borderRadius: "0 4px 0 0" },
  tick_bl: { bottom: 8, left: 8,  borderWidth: "0 0 2px 2px", borderRadius: "0 0 0 4px" },
  tick_br: { bottom: 8, right: 8, borderWidth: "0 2px 2px 0", borderRadius: "0 0 4px 0" },
};