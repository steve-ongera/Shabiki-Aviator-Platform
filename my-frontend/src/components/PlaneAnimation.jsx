import React, { useEffect, useRef } from "react";

/**
 * PlaneAnimation
 * Props: status ("waiting"|"betting"|"flying"|"crashed"), multiplier (string/number)
 * Uses pure CSS + requestAnimationFrame to move the plane along a curved path.
 */
export default function PlaneAnimation({ status, multiplier, crashPoint }) {
  const planeRef    = useRef(null);
  const canvasRef   = useRef(null);
  const frameRef    = useRef(null);
  const startRef    = useRef(null);
  const posRef      = useRef({ x: 0, y: 0 });

  const mult = parseFloat(multiplier) || 1.0;

  // Animate plane position based on multiplier (not time — driven by parent WS)
  useEffect(() => {
    const plane = planeRef.current;
    const canvas = canvasRef.current;
    if (!plane || !canvas) return;

    if (status === "flying") {
      // Map multiplier → position along the curved path
      // x: 0%→75% of canvas width, y: bottom→top (inverted)
      const progress = Math.min((mult - 1) / 20, 1); // saturate at 21x for position
      const cw = canvas.clientWidth  - 80;
      const ch = canvas.clientHeight - 60;

      // Quadratic curve: x linear, y accelerating upward
      const x = 60 + progress * cw;
      const y = (canvas.clientHeight - 45) - progress * progress * ch;

      // Tilt plane: angle of movement
      const dx = x - posRef.current.x;
      const dy = y - posRef.current.y;
      const angle = Math.atan2(-dy, dx) * (180 / Math.PI);

      plane.style.left      = `${x}px`;
      plane.style.bottom    = `${canvas.clientHeight - y - 18}px`;
      plane.style.transform = `rotate(${Math.max(-45, Math.min(0, angle - 15))}deg)`;
      plane.style.display   = "block";
      posRef.current = { x, y };
    } else if (status === "betting" || status === "waiting") {
      plane.style.left      = "60px";
      plane.style.bottom    = "40px";
      plane.style.transform = "rotate(0deg)";
      plane.style.display   = "block";
      posRef.current = { x: 60, y: canvas.clientHeight - 40 };
    } else if (status === "crashed") {
      plane.style.display = "none";
    }
  }, [status, mult]);

  const multClass =
    status === "flying"  ? "multiplier-flying"  :
    status === "betting" ? "multiplier-betting" :
    status === "crashed" ? "multiplier-crashed" :
    "multiplier-waiting";

  const multSize =
    mult >= 100 ? "2rem" :
    mult >= 10  ? "2.8rem" :
    "3.8rem";

  return (
    <div className="game-canvas" ref={canvasRef}>
      <div className="stars" />

      {/* Trajectory baseline */}
      {(status === "flying" || status === "crashed") && (
        <div className="trajectory-path" />
      )}

      {/* Plane */}
      <div
        ref={planeRef}
        className="plane-wrapper"
        style={{ position: "absolute", bottom: "40px", left: "60px", transition: "left .1s linear, bottom .1s linear" }}
      >
        <span className="plane-icon" role="img" aria-label="plane">✈️</span>
      </div>

      {/* Crash overlay */}
      {status === "crashed" && (
        <div className="crash-overlay">
          <div className="crash-text">FLEW AWAY!</div>
          <div style={{ fontFamily: "var(--font-display)", color: "var(--red)", fontSize: "1.5rem", marginTop: 4 }}>
            {crashPoint}×
          </div>
        </div>
      )}

      {/* Betting overlay */}
      {(status === "betting" || status === "waiting") && (
        <div className="betting-overlay">
          <div className="betting-label">
            <i className="bi bi-hourglass-split me-2" />
            Placing Bets...
          </div>
        </div>
      )}

      {/* Live multiplier on canvas (flying only) */}
      {status === "flying" && (
        <div
          className={`canvas-multiplier multiplier-value ${multClass}`}
          style={{ fontSize: multSize }}
        >
          {mult.toFixed(2)}×
        </div>
      )}
    </div>
  );
}