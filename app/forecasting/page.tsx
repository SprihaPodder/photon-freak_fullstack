"use client";

import { Sun, Waves, Gauge, TrendingUp, ShieldCheck, AlertTriangle } from "lucide-react";

import SectionHeader from "@/components/ui/SectionHeader";
import GlassPanel from "@/components/ui/GlassPanel";
import MetricTicker from "@/components/ui/MetricTicker";
import ForecastBand from "@/components/charts/ForecastBand";
import ModelComparisonBars from "@/components/charts/ModelComparisonBars";
import VMDModeStack from "@/components/charts/VMDModeStack";
import SolarForecastingForm from "@/components/SolarForecastingForm";
import ScrollToForecastToolButton from "@/components/forecasting/ScrollToForecastToolButton";
import { COLORS } from "@/lib/constants";

import vmd from "@/lib/data/vmd-lightgbm.json";

const noVmdAblation = vmd.baseline_comparison.find((b) => b.name.includes("No VMD"));

const modelCompare = [
  { name: "No VMD (Ablation)", r2: noVmdAblation ? noVmdAblation.r2_daytime : 0 },
  { name: "AK-VMD+QLightGBM Daytime", r2: vmd.metrics.r2_daytime },
  { name: "AK-VMD+QLightGBM All Hours", r2: vmd.metrics.r2_all_hours },
];

const baselineCompare = vmd.baseline_comparison.map((b) => ({
  name: b.name.replace("Proposed AK-VMD+QLightGBM", "Proposed AK-VMD"),
  accuracy_pct: b.r2_daytime,
}));

export default function ForecastingPage() {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Solar Generation Forecasting"
          subtitle="A single adaptive-decomposition pipeline — AK-VMD + Quantile LightGBM — evaluated on all-hours and daytime-only windows, with calibrated uncertainty via simultaneous quantile regression."
        />
        <ScrollToForecastToolButton />
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-3">
        <GlassPanel accent={COLORS.cyan} style={{ padding: 22 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
            <Sun size={13} /> AK-VMD + QLightGBM (Daytime)
          </div>
          <MetricTicker label="R² (daytime)" value={vmd.metrics.r2_daytime} decimals={4} accent={COLORS.cyan} />
          <div className="mt-3.5 flex gap-5 font-mono text-xs" style={{ color: COLORS.muted }}>
            <div>No-VMD Ablation R² <b style={{ color: COLORS.text }}>{noVmdAblation ? noVmdAblation.r2_daytime : "—"}</b></div>
            <div>Test Hours <b style={{ color: COLORS.text }}>820</b></div>
          </div>
        </GlassPanel>

        <GlassPanel accent={COLORS.violet} style={{ padding: 22 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.violet }}>
            <Waves size={13} /> AK-VMD + QLightGBM (All Hours)
          </div>
          <MetricTicker label="R² all hours" value={vmd.metrics.r2_all_hours} decimals={4} accent={COLORS.violet} />
          <div className="mt-3.5 flex gap-5 font-mono text-xs" style={{ color: COLORS.muted }}>
            <div>MAE <b style={{ color: COLORS.text }}>{vmd.metrics.mae_kw} kW</b></div>
            <div>PICP 90% <b style={{ color: COLORS.text }}>{vmd.metrics.picp_90_pct}%</b></div>
          </div>
        </GlassPanel>

        <GlassPanel accent={COLORS.mint} style={{ padding: 22 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.mint }}>
            <Gauge size={13} /> Adaptive-K Selection
          </div>
          <MetricTicker label="Modes chosen (K)" value={vmd.adaptive_k.selected_k} accent={COLORS.mint} />
          <div className="mt-3.5 text-xs" style={{ color: COLORS.muted }}>
            vs. fixed K={vmd.adaptive_k.literature_default_k} used in {vmd.adaptive_k.literature_using_fixed_k3_pct}% of{" "}
            {vmd.adaptive_k.literature_studies_reviewed} reviewed VMD-solar studies.
          </div>
        </GlassPanel>
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <GlassPanel accent={COLORS.cyan} style={{ padding: 24, height: 320 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
            <TrendingUp size={13} /> Model R² Comparison
          </div>
          <div style={{ height: "86%" }}>
            <ForecastBand data={modelCompare} colors={[COLORS.amber, COLORS.cyan, COLORS.violet]} />
          </div>
        </GlassPanel>

        <GlassPanel accent={COLORS.mint} style={{ padding: 24, height: 320 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.mint }}>
            <ShieldCheck size={13} /> Baseline & Ablation (Daytime R²)
          </div>
          <div style={{ height: "86%" }}>
            <ModelComparisonBars
              data={baselineCompare}
              highlightName="Proposed AK-VMD"
              highlightColor={COLORS.mint}
              domain={[0, 1]}
            />
          </div>
        </GlassPanel>
      </div>

      <GlassPanel accent={COLORS.amber} style={{ padding: 24, height: 300 }}>
        <div className="glass-eyebrow" style={{ color: COLORS.amber }}>
          <AlertTriangle size={13} /> Fixed-K vs Adaptive-K Sensitivity
        </div>
        <div style={{ height: "78%" }}>
          <VMDModeStack data={vmd.vmd_sensitivity} />
        </div>
        <div className="mt-1.5 text-[11.5px]" style={{ color: COLORS.muted }}>
          The Kraljevo GHI signal contains ≥6 distinguishable frequency bands — literature&apos;s default K=3 barely beats
          persistence (R²=0.29).
        </div>
      </GlassPanel>

      <div className="mt-5">
        <SolarForecastingForm />
      </div>
    </>
  );
}
