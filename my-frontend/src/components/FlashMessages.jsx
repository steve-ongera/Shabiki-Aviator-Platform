import React from "react";
import { useFlash } from "../App";

const ICONS = {
  success: "bi-check-circle-fill",
  error:   "bi-x-circle-fill",
  info:    "bi-info-circle-fill",
  warning: "bi-exclamation-triangle-fill",
};
const COLORS = {
  success: "#22c55e",
  error:   "#ef4444",
  info:    "#06b6d4",
  warning: "#eab308",
};

export default function FlashMessages() {
  const { flashes, dismissFlash } = useFlash();
  if (!flashes.length) return null;

  return (
    <div className="flash-container">
      {flashes.map((f) => (
        <div key={f.id} className={`flash-toast ${f.type}`} role="alert">
          <i
            className={`bi ${ICONS[f.type] || ICONS.info}`}
            style={{ color: COLORS[f.type], fontSize: "1rem", marginTop: 2 }}
          />
          <span style={{ flex: 1, color: "#f1f5f9", fontSize: ".85rem" }}>
            {f.message}
          </span>
          <button className="flash-close" onClick={() => dismissFlash(f.id)}>
            <i className="bi bi-x" />
          </button>
        </div>
      ))}
    </div>
  );
}