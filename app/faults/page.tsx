"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { ScanEye, ShieldCheck, Cpu } from "lucide-react";

import SectionHeader from "@/components/ui/SectionHeader";
import GlassPanel from "@/components/ui/GlassPanel";
import MetricTicker from "@/components/ui/MetricTicker";
import ModelComparisonBars from "@/components/charts/ModelComparisonBars";
import ChartTooltip from "@/components/charts/ChartTooltip";
import { COLORS } from "@/lib/constants";
import FaultPredictionForm from "@/components/FaultPredictionForm";

import faultDetection from "@/lib/data/fault-detection.json";

const perClass = faultDetection.single_run_seed0.per_class.map((c) => ({
  cls: c.class.replace("-damage", "").replace("-Damage", ""),
  precision: c.precision,
  recall: c.recall,
  f1: c.f1,
}));

const modelBaselines = faultDetection.baseline_comparison.map((m) => ({
  name: m.model,
  accuracy_pct: m.accuracy_pct,
}));

export default function FaultsPage() {
  const { five_seed_robustness } = faultDetection;

  return (
    <>
      <SectionHeader
        title="SolarGuard-Net — Panel Fault Detection"
        subtitle="EfficientNetV2-S backbone with CBAM channel/spatial attention and FPN multi-scale fusion, Grad-CAM localized for maintenance-aware scheduling."
      />
      <button onClick={() => document.getElementById("fault-predictor")?.scrollIntoView({ behavior: "smooth" })} className="mb-5 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: COLORS.amber, color: COLORS.amber }}>Try your own panel image ↓</button>

      <div className="mb-5 grid gap-5 md:grid-cols-4">
        <GlassPanel accent={COLORS.amber} style={{ padding: 20 }}>
          <MetricTicker label="Test Accuracy (TTA×7)" value={five_seed_robustness.test_accuracy_pct.mean} decimals={2} suffix="%" accent={COLORS.amber} />
        </GlassPanel>
        <GlassPanel accent={COLORS.amber} style={{ padding: 20 }}>
          <MetricTicker label="Weighted F1" value={five_seed_robustness.weighted_f1_pct.mean} decimals={2} suffix="%" accent={COLORS.amber} />
        </GlassPanel>
        <GlassPanel accent={COLORS.mint} style={{ padding: 20 }}>
          <MetricTicker label="Electrical-Damage F1 (highest risk)" value={five_seed_robustness.f1_electrical_damage_pct.mean} decimals={2} suffix="%" accent={COLORS.mint} />
        </GlassPanel>
        <GlassPanel accent={COLORS.mint} style={{ padding: 20 }}>
          <MetricTicker label="Std Dev Across 5 Seeds" value={five_seed_robustness.test_accuracy_pct.std} decimals={2} suffix="%" accent={COLORS.mint} />
        </GlassPanel>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <GlassPanel accent={COLORS.amber} style={{ padding: 24, height: 320 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.amber }}>
            <ScanEye size={13} /> Per-Class Precision / Recall / F1 (Seed 0, n=375)
          </div>
          <div style={{ height: "86%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perClass} margin={{ top: 14, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="cls" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <YAxis domain={[85, 100]} tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: COLORS.muted }} />
                <Bar dataKey="precision" name="Precision" fill={COLORS.cyan} fillOpacity={0.8} radius={[6, 6, 0, 0]} />
                <Bar dataKey="recall" name="Recall" fill={COLORS.violet} fillOpacity={0.8} radius={[6, 6, 0, 0]} />
                <Bar dataKey="f1" name="F1" fill={COLORS.amber} fillOpacity={0.85} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel accent={COLORS.violet} style={{ padding: 24, height: 320 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.violet }}>
            <ShieldCheck size={13} /> Model Comparison — Identical Split
          </div>
          <div style={{ height: "78%" }}>
            <ModelComparisonBars
              data={modelBaselines}
              highlightName="SolarGuard-Net"
              highlightColor={COLORS.violet}
              domain={[90, 97]}
            />
          </div>
          <div className="mt-1 text-[11px]" style={{ color: COLORS.muted }}>
            Matches EfficientNetB0 on accuracy; its contribution is CBAM+FPN fault-region localization via Grad-CAM, not
            raw accuracy.
          </div>
        </GlassPanel>
      </div>

      <GlassPanel accent={COLORS.cyan} style={{ padding: 22 }}>
        <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
          <Cpu size={13} /> Architecture
        </div>
        <div
          className="mt-1.5 rounded-[10px] p-3.5 font-mono text-[13px]"
          style={{ background: "rgba(0,0,0,0.25)", color: COLORS.text }}
        >
          {faultDetection.formula}
        </div>
        <div className="mt-2 text-[11.5px]" style={{ color: COLORS.muted }}>
          Three EfficientNetV2-S feature maps (48-/160-/256-channel) fused via FPN neck; trained with Focal Loss,
          MixUp/CutMix, SWA from epoch 45, TTA×7 at inference.
        </div>
      </GlassPanel>
      <FaultPredictionForm />
    </>
  );
}
