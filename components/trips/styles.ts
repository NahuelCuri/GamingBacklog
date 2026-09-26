// Trip Planner look, from legacy: its own always-dark palette (it never followed
// the light theme). Shared inline styles for inputs, buttons and dialogs.
import type { CSSProperties } from "react";

export const T = {
  accent: "#5fb8b0",
  onAccent: "#06201e",
  bg: "#0c0e0f",
  panel: "#0e1112",
  dialog: "#0f1213",
  card: "#14181a",
  text: "#e9edee",
  text2: "#c6cfcc",
  muted: "#9aa7a4",
  muted2: "#8a9693",
  dim: "#7a8683",
  dim2: "#6b7673",
  dim3: "#5f6b68",
  faint: "#4f5a57",
  line: "#1d2224",
  line2: "#1a1f20",
  border: "#262c2e",
  border2: "#2a3234",
  price: "#c9a56e",
  must: "#e0a86b",
  danger: "#d98a8a",
  warn: "#d98a6a",
  mono: "var(--font-jetbrains), monospace",
} as const;

export const input: CSSProperties = {
  width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 11px",
  color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none",
};

export const fieldLabel: CSSProperties = { fontSize: 11, fontWeight: 600, color: T.muted2, marginBottom: 6 };

export const btnPrimary: CSSProperties = {
  font: "inherit", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: T.onAccent, background: T.accent, border: "none", padding: "9px 20px", borderRadius: 8,
};

export const btnGhost: CSSProperties = {
  font: "inherit", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: T.muted, padding: "9px 15px", borderRadius: 8, border: `1px solid ${T.border2}`,
};

export const overlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
  background: "rgba(6,8,9,.62)", backdropFilter: "blur(3px)", overscrollBehavior: "contain",
};

export const dialogPanel: CSSProperties = {
  width: "100%", maxWidth: 460, maxHeight: "88vh", display: "flex", flexDirection: "column", background: T.dialog,
  ...frame(T.border, "top", T.border, 1), borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6)", outline: "none",
};

export const dialogHead: CSSProperties = {
  flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "14px 18px", borderBottom: `1px solid ${T.line2}`,
};

export const dialogFoot: CSSProperties = {
  flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 18px", borderTop: `1px solid ${T.line2}`,
};

export const kicker: CSSProperties = { fontFamily: T.mono, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#7f8c89" };

export const closeX: CSSProperties = { cursor: "pointer", background: "none", border: "none", color: T.dim, fontSize: 18, lineHeight: 1 };

export const typeTag = (color: string, size = 10): CSSProperties => ({
  fontFamily: T.mono, fontSize: size, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color,
});

/** Toggle chip: accent-filled when active (legacy `chip()`). */
export function chip(active: boolean, color?: string): CSSProperties {
  return {
    background: active ? color || T.accent : "transparent",
    color: active ? T.onAccent : color || "#9aa7a4",
    border: `1px solid ${active ? "transparent" : T.border2}`,
  };
}

/** Filter pill (type filters); inactive text is dimmer than `chip`. */
export function filterPill(active: boolean, color?: string): CSSProperties {
  return {
    background: active ? color || T.accent : "transparent",
    color: active ? T.onAccent : color || T.muted2,
    border: `1px solid ${active ? "transparent" : T.border2}`,
  };
}

export const statusDot = (dot: string, glow: string, size = 9): CSSProperties => ({
  flex: "0 0 auto", width: size, height: size, borderRadius: "50%", background: dot, boxShadow: glow,
});

export const tagChip: CSSProperties = {
  fontSize: 11.5, padding: "4px 9px", borderRadius: 20, color: "#9fd8d1", background: "rgba(95,184,176,.12)", border: "1px solid rgba(95,184,176,.32)",
};

/**
 * "Important" cards carry a warm frame and tint that read without any motion,
 * plus a glow that runs three times when the card appears (or turns important).
 */
export const IMPORTANT_EDGE = "rgba(224,168,107,.38)";
export const importantCard = (on: boolean, bg: string): CSSProperties =>
  on ? { background: `color-mix(in srgb, ${T.must} 7%, ${bg})`, animation: "pulseGlow 2.6s ease-in-out 3" } : { background: bg };

/**
 * A 1px border with one thicker coloured side, as longhands: mixing `border`
 * with `borderLeft` makes React warn when either changes on re-render.
 */
export function frame(color: string, side: "left" | "top", accent: string, width = 3): CSSProperties {
  const line = `1px solid ${color}`;
  return {
    borderTop: side === "top" ? `${width}px solid ${accent}` : line,
    borderRight: line,
    borderBottom: line,
    borderLeft: side === "left" ? `${width}px solid ${accent}` : line,
  };
}
