"use client";

import { BatteryMedium, ShieldCheck, Gauge } from "lucide-react";

import ScrollToUploadButton from "@/components/ScrollToUploadButton_battery";
import BatteryHealthGrid from "@/components/BatteryHealthGrid";
import SectionHeader from "@/components/ui/SectionHeader";
import GlassPanel from "@/components/ui/GlassPanel";
import MetricTicker from "@/components/ui/MetricTicker";
import SoHTrajectory, { generateDegradationCurve } from "@/components/charts/SoHTrajectory";
import ConfusionMatrix from "@/components/charts/ConfusionMatrix";
import SoCScheduleChart from "@/components/charts/SoCScheduleChart";
import { COLORS } from "@/lib/constants";

import batteryHealth from "@/lib/data/battery-health.json";

const degCurve = generateDegradationCurve();

export default function BatteryPage() {
  const { metrics, confusion_matrix, soh_sweep, degradation_trajectory } = batteryHealth;

  return (
    <>
      <div className="mb-0 flex flex-wrap items-start justify-between gap-3">
        <SectionHeader
          title="Battery Health & Degradation"
          subtitle="DVG-BiLSTM jointly estimates State of Health, Remaining Useful Life, and Remaining Useful Energy — with Monte-Carlo calibrated uncertainty."
        />
        <ScrollToUploadButton />
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-4">
        <GlassPanel accent={COLORS.violet} style={{ padding: 20 }}>
          <MetricTicker label="SoH MAE" value={metrics.soh_mae_pct} decimals={3} suffix="%" accent={COLORS.violet} />
        </GlassPanel>
        <GlassPanel accent={COLORS.violet} style={{ padding: 20 }}>
          <MetricTicker label="SoH R²" value={metrics.soh_r2} decimals={4} accent={COLORS.violet} />
        </GlassPanel>
        <GlassPanel accent={COLORS.mint} style={{ padding: 20 }}>
          <MetricTicker label="Health-State Macro-F1" value={metrics.health_state_macro_f1} decimals={2} accent={COLORS.mint} />
        </GlassPanel>
        <GlassPanel accent={COLORS.mint} style={{ padding: 20 }}>
          <MetricTicker label="MC-Dropout 95% CI Coverage" value={metrics.mc_dropout_ci_coverage_pct} decimals={1} suffix="%" accent={COLORS.mint} />
        </GlassPanel>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <GlassPanel accent={COLORS.violet} style={{ padding: 24, height: 360 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.violet }}>
            <BatteryMedium size={13} /> SoH Degradation Trajectory — Representative Test Battery
          </div>
          <div style={{ height: "84%" }}>
            <SoHTrajectory data={degCurve} eolThreshold={degradation_trajectory.eol_threshold_pct} />
          </div>
          <div className="mt-1 text-[11.5px]" style={{ color: COLORS.muted }}>
            Declines ~{degradation_trajectory.start_soh_pct}% → {degradation_trajectory.end_soh_pct}% over{" "}
            {degradation_trajectory.cycles} cycles; crosses the {degradation_trajectory.eol_threshold_pct}% end-of-life
            threshold at ≈cycle {degradation_trajectory.eol_crossed_at_cycle}.
          </div>
        </GlassPanel>

        <GlassPanel accent={COLORS.mint} style={{ padding: 24 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.mint }}>
            <ShieldCheck size={13} /> Health-State Confusion Matrix
          </div>
          <ConfusionMatrix labels={confusion_matrix.labels} matrix={confusion_matrix.matrix} />
          <div className="mt-3.5 text-[11px]" style={{ color: COLORS.muted }}>
            Misclassifications cluster at the 90% SoH decision boundary. Second-life classification: P{" "}
            {metrics.second_life_precision} / R {metrics.second_life_recall} / F1 {metrics.second_life_f1}.
          </div>
        </GlassPanel>
      </div>

      <div className="mb-5">
        <BatteryHealthGrid apiBaseUrl={process.env.NEXT_PUBLIC_BATTERY_API_URL} />
      </div>

      <GlassPanel accent={COLORS.cyan} style={{ padding: 24, height: 300 }}>
        <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
          <Gauge size={13} /> SoH-Conditioned Charging Ceiling — Sweep Results
        </div>
        <div style={{ height: "78%" }}>
          <SoCScheduleChart data={soh_sweep} />
        </div>
        <div className="mt-1 text-[11.5px]" style={{ color: COLORS.muted }}>
          As SoH falls 100%→70%, peak C-rate is derated 66.7% (0.0621C→0.0207C), spreading charging across +52.1pp more
          of the schedule; total cost falls 16.7% (₹195.2→₹162.5).
        </div>
      </GlassPanel>
    </>
  );
}