# AXIS — Solar-EV Intelligence Mission Control

A futuristic, data-accurate mission-control dashboard unifying two research
pipelines:

1. **Battery-Health-Aware, Fault-Aware AI Framework** — CNN-LSTM-Transformer
   solar forecasting → DVG-BiLSTM battery health → PSO-GA charging optimizer
   → SolarGuard-Net fault detection → IoT edge-cloud deployment.
2. **AK-VMD + Quantile LightGBM** — Adaptive-K Variational Mode Decomposition
   → probabilistic quantile forecasting → 3-tier EV charging signal.

Built with Next.js 14 (App Router) + TypeScript + Tailwind CSS + React Three
Fiber + Framer Motion + Recharts. See `DEVELOPMENT_PLAN.md` (project root,
delivered alongside this codebase) for the full design-system and
architecture writeup.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Routes:

| Route            | Page                                     |
|-------------------|-------------------------------------------|
| `/`               | Overview — signature energy-flow graph + headline metrics |
| `/forecasting`     | CNN-LSTM-Transformer vs AK-VMD+QLightGBM   |
| `/battery`         | DVG-BiLSTM SoH / RUL / RUE + confusion matrix |
| `/charging`        | PSO-GA optimizer + 3-tier EV charging signal |
| `/faults`          | SolarGuard-Net fault classification        |
| `/system`          | IoT edge/cloud architecture + integrated trace |

## Verified

- `npx tsc --noEmit` — clean, zero errors
- `npx next build` — all 6 routes compile and statically pre-render
  (verified in this dev sandbox with Google Fonts network-stubbed, since
  this sandbox's egress allowlist doesn't include fonts.googleapis.com —
  it will fetch normally on any machine with open internet access)

## Data

All numbers are sourced directly from the two papers and live in
`lib/data/*.json` — nothing in the UI is hardcoded inline, so updating a
metric means editing one JSON file, not hunting through components.

## Next steps (see DEVELOPMENT_PLAN.md, Phase 4–6)

- Wire `hooks/useScrollCamera.ts` (Lenis) into a scroll-tied R3F camera rig
- Drop `components/canvas/PostFX.tsx` into the `<Canvas>` in
  `ParticleField.tsx` for bloom/chromatic-aberration (kept separate so you
  can gate it behind a device-tier / `prefers-reduced-motion` check)
- Swap the R3F canvas for a CSS aurora gradient on low-tier/mobile devices
