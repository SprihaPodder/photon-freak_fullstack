import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#05070c",
        panel: "rgba(13,19,30,0.52)",
        panelSolid: "#0b111c",
        borderGlass: "rgba(140,170,255,0.14)",
        borderHi: "rgba(140,190,255,0.32)",
        cyan: "#4fd8ff",
        violet: "#8b7cff",
        amber: "#ffb454",
        mint: "#5cf2c0",
        ink: "#e9effb",
        muted: "#8592ac",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      backdropBlur: {
        glass: "18px",
      },
      boxShadow: {
        glass: "0 0 0 1px rgba(255,255,255,0.02) inset, 0 20px 60px -20px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
