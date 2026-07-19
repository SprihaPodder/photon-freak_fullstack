// Shared design tokens (mirrors styles/tokens.css) for use inside JS/TS
// logic — chart fills, canvas materials, threshold bands, etc.

export const COLORS = {
  void: "#05070c",
  panel: "rgba(13,19,30,0.52)",
  panelSolid: "#0b111c",
  border: "rgba(140,170,255,0.14)",
  borderHi: "rgba(140,190,255,0.32)",
  cyan: "#4fd8ff",
  violet: "#8b7cff",
  amber: "#ffb454",
  mint: "#5cf2c0",
  text: "#e9effb",
  muted: "#8592ac",
} as const;

export const SECTIONS = [
  { id: "overview", href: "/", label: "Overview", icon: "network" },
  { id: "forecast", href: "/forecasting", label: "Forecasting", icon: "sun" },
  { id: "battery", href: "/battery", label: "Battery Health", icon: "battery" },
  { id: "charging", href: "/charging", label: "EV Charging", icon: "zap" },
  { id: "faults", href: "/faults", label: "Fault Detection", icon: "scan-eye" },
  { id: "system", href: "/system", label: "Integrated System", icon: "circuit-board" },
] as const;

// SoH classification bands used by the DVG-BiLSTM battery module
export const SOH_BANDS = {
  healthy: { min: 90, label: "Healthy", color: COLORS.mint },
  degraded: { min: 70, max: 90, label: "Degraded", color: COLORS.amber },
  critical: { max: 70, label: "Critical", color: "#ff6b6b" },
} as const;

// Charging power derating curve g(SoH) — from Section IV-C of Paper 1
export const G_SOH = [
  { soh: 100, g: 1 },
  { soh: 90, g: 1 },
  { soh: 80, g: 2 },
  { soh: 70, g: 3 },
] as const;

export const EASE = {
  glass: [0.2, 0.8, 0.2, 1],
  outExpo: [0.16, 1, 0.3, 1],
} as const;
