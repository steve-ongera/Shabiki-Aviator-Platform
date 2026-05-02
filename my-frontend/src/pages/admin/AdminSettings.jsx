// pages/admin/AdminSettings.jsx
import React, { useEffect, useState } from "react";
import { useFlash } from "../../App";
import api from "../../utils/api";

const SECTIONS = ["Game Rules", "Payments", "Security", "Maintenance"];

const FIELD_DEFS = {
  "Game Rules": [
    { key: "GAME_MIN_BET",       label: "Min Bet (KES)",     type: "number", min: 1,    step: 1,    hint: "Minimum amount a player can wager per round" },
    { key: "GAME_MAX_BET",       label: "Max Bet (KES)",     type: "number", min: 100,  step: 100,  hint: "Maximum single bet ceiling" },
    { key: "GAME_HOUSE_EDGE",    label: "House Edge (%)",    type: "number", min: 0,    max: 50, step: 0.1, hint: "Platform cut applied before crash calculation (0–50%)", transform: (v) => parseFloat(v) / 100, display: (v) => parseFloat((v * 100).toFixed(2)) },
    { key: "GAME_BETTING_PHASE", label: "Betting Phase (s)", type: "number", min: 3,    max: 30, step: 1,  hint: "Seconds players have to place bets before takeoff" },
    { key: "GAME_COOLDOWN",      label: "Cooldown (s)",      type: "number", min: 2,    max: 30, step: 1,  hint: "Pause between rounds" },
  ],
  "Payments": [
    { key: "MPESA_MIN_DEPOSIT",   label: "M-Pesa Min Deposit (KES)",   type: "number", min: 10,   step: 10 },
    { key: "MPESA_MAX_DEPOSIT",   label: "M-Pesa Max Deposit (KES)",   type: "number", min: 100,  step: 100 },
    { key: "MPESA_MIN_WITHDRAW",  label: "M-Pesa Min Withdraw (KES)",  type: "number", min: 10,   step: 10 },
    { key: "PAYPAL_MIN_WITHDRAW", label: "PayPal Min Withdraw (KES)",  type: "number", min: 100,  step: 100 },
    { key: "DEV_AUTO_APPROVE",    label: "Dev Auto-Approve Deposits",  type: "toggle", hint: "Instantly approve deposits in dev mode" },
  ],
  "Security": [
    { key: "JWT_ACCESS_MINUTES",   label: "JWT Access TTL (min)",    type: "number", min: 5,  max: 1440, step: 5 },
    { key: "JWT_REFRESH_DAYS",     label: "JWT Refresh TTL (days)",  type: "number", min: 1,  max: 30,   step: 1 },
    { key: "RATE_LIMIT_BET",       label: "Bet Rate Limit (req/min)",type: "number", min: 1,  max: 300,  step: 1 },
    { key: "RATE_LIMIT_DEPOSIT",   label: "Deposit Rate (req/min)",  type: "number", min: 1,  max: 60,   step: 1 },
  ],
  "Maintenance": [
    { key: "MAINTENANCE_MODE",     label: "Maintenance Mode",   type: "toggle", hint: "Block all player access with a maintenance screen" },
    { key: "CHAT_ENABLED",         label: "Live Chat Enabled",  type: "toggle" },
    { key: "REGISTRATION_OPEN",    label: "New Registrations",  type: "toggle" },
  ],
};

export default function AdminSettings() {
  const { flash } = useFlash();
  const [activeSection, setActiveSection] = useState("Game Rules");
  const [settings, setSettings]   = useState({});
  const [original, setOriginal]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/settings/");
        setSettings(data);
        setOriginal(data);
      } catch {
        flash("Failed to load settings", "danger");
      } finally {
        setLoading(false);
      }
    })();
  }, [flash]);

  const handleChange = (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch("/admin/settings/", settings);
      setOriginal(data);
      setSettings(data);
      flash("Settings saved successfully", "success");
    } catch {
      flash("Failed to save settings", "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({ ...original });
    flash("Changes discarded", "info");
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(original);

  const fields = FIELD_DEFS[activeSection] || [];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Admin / Settings</div>
          <h1 style={s.title}>Platform Settings</h1>
          <div style={s.subtitle}>Changes take effect immediately after saving</div>
        </div>
        {hasChanges && (
          <div style={s.changesBanner}>
            <span style={s.changesText}>● Unsaved changes</span>
            <button style={s.resetBtn}  onClick={handleReset}>Discard</button>
            <button style={s.saveBtn}   onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      <div style={s.layout}>
        {/* Sidebar tabs */}
        <nav style={s.sidebar}>
          {SECTIONS.map((sec) => (
            <button
              key={sec}
              style={{ ...s.tabBtn, ...(activeSection === sec ? s.tabActive : {}) }}
              onClick={() => setActiveSection(sec)}
            >
              {sec === "Game Rules"   && <span style={s.tabIcon}>🎮</span>}
              {sec === "Payments"     && <span style={s.tabIcon}>💳</span>}
              {sec === "Security"     && <span style={s.tabIcon}>🔐</span>}
              {sec === "Maintenance"  && <span style={s.tabIcon}>🔧</span>}
              {sec}
            </button>
          ))}
        </nav>

        {/* Fields panel */}
        <div style={s.panel}>
          {loading ? (
            <div style={s.loadingState}>Loading settings…</div>
          ) : (
            <>
              <div style={s.sectionTitle}>{activeSection}</div>
              <div style={s.fields}>
                {fields.map((field) => {
                  const rawVal = settings[field.key];
                  const displayVal = field.display ? field.display(rawVal ?? 0) : rawVal;
                  const isDirty = settings[field.key] !== original[field.key];

                  return (
                    <div key={field.key} style={{ ...s.fieldRow, ...(isDirty ? s.fieldDirty : {}) }}>
                      <div style={s.fieldLeft}>
                        <div style={s.fieldLabel}>
                          {field.label}
                          {isDirty && <span style={s.dirtyPill}>modified</span>}
                        </div>
                        {field.hint && <div style={s.fieldHint}>{field.hint}</div>}
                        <div style={s.fieldKey}>{field.key}</div>
                      </div>

                      <div style={s.fieldRight}>
                        {field.type === "toggle" ? (
                          <button
                            style={{
                              ...s.toggle,
                              ...(rawVal ? s.toggleOn : s.toggleOff),
                            }}
                            onClick={() => handleChange(field.key, !rawVal)}
                          >
                            <span style={{ ...s.toggleThumb, transform: rawVal ? "translateX(22px)" : "translateX(2px)" }} />
                          </button>
                        ) : (
                          <input
                            type="number"
                            style={{ ...s.input, ...(isDirty ? s.inputDirty : {}) }}
                            value={displayVal ?? ""}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            onChange={(e) => {
                              const val = field.transform
                                ? field.transform(e.target.value)
                                : field.step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                              handleChange(field.key, val);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Section save shortcut */}
              <div style={s.panelFooter}>
                <button
                  style={s.saveBtn}
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? "Saving…" : "Save All Changes"}
                </button>
                {hasChanges && (
                  <button style={s.resetBtn} onClick={handleReset}>Discard</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ── */
const s = {
  page:         { minHeight: "100vh", background: "#030712", color: "#e2e8f0", padding: "32px 24px", fontFamily: "'Courier New', monospace" },
  header:       { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 },
  breadcrumb:   { fontSize: 12, color: "#475569", letterSpacing: "0.1em", marginBottom: 6 },
  title:        { margin: 0, fontSize: 28, fontWeight: 900, fontFamily: "Georgia, serif", color: "#f8fafc" },
  subtitle:     { fontSize: 13, color: "#64748b", marginTop: 4 },
  changesBanner:{ display: "flex", alignItems: "center", gap: 12, background: "#0f172a", border: "1px solid #facc1566", borderRadius: 10, padding: "12px 16px" },
  changesText:  { fontSize: 13, color: "#facc15", marginRight: 4 },
  layout:       { display: "flex", gap: 24, alignItems: "flex-start" },
  sidebar:      { display: "flex", flexDirection: "column", gap: 4, minWidth: 190, flexShrink: 0 },
  tabBtn:       { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "transparent", border: "1px solid transparent", borderRadius: 10, color: "#64748b", cursor: "pointer", fontSize: 13, fontFamily: "'Courier New', monospace", textAlign: "left", transition: "all 0.2s" },
  tabActive:    { background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0" },
  tabIcon:      { fontSize: 16 },
  panel:        { flex: 1, background: "#0a1120", border: "1px solid #1e293b", borderRadius: 16, padding: "28px 32px", minHeight: 400 },
  loadingState: { color: "#475569", textAlign: "center", padding: "80px 0" },
  sectionTitle: { fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 900, color: "#f8fafc", marginBottom: 24 },
  fields:       { display: "flex", flexDirection: "column", gap: 0 },
  fieldRow:     { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", borderBottom: "1px solid #0f172a", gap: 24, transition: "background 0.2s", borderRadius: 8 },
  fieldDirty:   { background: "#facc1508", padding: "18px 12px", marginLeft: -12, marginRight: -12 },
  fieldLeft:    { flex: 1 },
  fieldLabel:   { fontWeight: 700, color: "#e2e8f0", fontSize: 14, display: "flex", alignItems: "center", gap: 8 },
  fieldHint:    { fontSize: 11, color: "#475569", marginTop: 4, lineHeight: 1.5 },
  fieldKey:     { fontSize: 10, color: "#334155", marginTop: 4, letterSpacing: "0.08em" },
  fieldRight:   { flexShrink: 0 },
  dirtyPill:    { fontSize: 10, background: "#facc1522", color: "#facc15", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.06em" },
  input:        { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 14, outline: "none", width: 120, textAlign: "right", fontFamily: "'Courier New', monospace" },
  inputDirty:   { borderColor: "#facc1566", boxShadow: "0 0 0 3px #facc1511" },
  toggle:       { width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative", transition: "background 0.3s", padding: 0 },
  toggleOn:     { background: "#4ade80" },
  toggleOff:    { background: "#334155" },
  toggleThumb:  { position: "absolute", top: 2, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "transform 0.25s cubic-bezier(.4,0,.2,1)" },
  panelFooter:  { display: "flex", gap: 12, marginTop: 32, paddingTop: 24, borderTop: "1px solid #0f172a" },
  saveBtn:      { background: "#22d3ee", border: "none", color: "#030712", borderRadius: 8, padding: "11px 24px", fontWeight: 900, fontSize: 13, cursor: "pointer", letterSpacing: "0.05em", fontFamily: "'Courier New', monospace", transition: "opacity 0.2s" },
  resetBtn:     { background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "11px 18px", cursor: "pointer", fontSize: 13, fontFamily: "'Courier New', monospace", transition: "all 0.2s" },
};