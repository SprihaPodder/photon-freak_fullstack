"use client";

import { motion } from "framer-motion";
import { Sun, BatteryMedium, Zap, ScanEye, Network } from "lucide-react";

import SectionHeader from "@/components/ui/SectionHeader";
import GlassPanel from "@/components/ui/GlassPanel";
import MetricTicker from "@/components/ui/MetricTicker";
import EnergyFlowGraph from "@/components/canvas/EnergyFlowGraph";
import { COLORS } from "@/lib/constants";
import { fadeUp, staggerContainer } from "@/lib/animations";

import batteryHealth from "@/lib/data/battery-health.json";
import faultDetection from "@/lib/data/fault-detection.json";
import chargingOptimizer from "@/lib/data/charging-optimizer.json";

const CAPABILITIES = [
  {
    icon: Sun,
    accent: COLORS.cyan,
    title: "Forecasting",
    desc: "Adaptive-K VMD (auto-selects K=6 via entropy-NRMSE) + 58-feature physics-guided engineering, driving Quantile LightGBM for point & probabilistic solar generation.",
  },
  {
    icon: BatteryMedium,
    accent: COLORS.violet,
    title: "Battery Health",
    desc: "Degradation-velocity-gated BiLSTM jointly predicts SoH, RUL & RUE with calibrated uncertainty.",
  },
  {
    icon: Zap,
    accent: COLORS.mint,
    title: "Charging Optimizer",
    desc: "Multi-objective PSO-GA derates charging power directly from live SoH — a real BMS-consistent power ceiling.",
  },
  {
    icon: ScanEye,
    accent: COLORS.amber,
    title: "Fault Vision",
    desc: "SolarGuard-Net: EfficientNetV2-S + CBAM attention + FPN fusion, Grad-CAM localized.",
  },
];

export default function OverviewPage() {
  return (
    <>
      <SectionHeader
        title="Solar–EV Intelligence, Unified"
        subtitle="Two coupled research pipelines — forecasting, battery diagnostics, fault vision, and charging optimization — converged into a single decision loop."
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <GlassPanel accent={COLORS.cyan} style={{ padding: 28, minHeight: 340 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
            <Network size={13} /> Live Signal Path
          </div>
          <div style={{ height: 340 }}>
            <EnergyFlowGraph />
          </div>
        </GlassPanel>

        <motion.div
          className="grid grid-cols-2 gap-5"
          initial="hidden"
          animate="show"
          variants={staggerContainer}
        >
          <motion.div variants={fadeUp}>
            <GlassPanel accent={COLORS.cyan} style={{ padding: 22 }}>
              <MetricTicker
                label="Solar Forecast R² (AK-VMD+QLightGBM, All Hours)"
                value={0.9901}
                decimals={4}
                accent={COLORS.cyan}
              />
            </GlassPanel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GlassPanel accent={COLORS.violet} style={{ padding: 22 }}>
              <MetricTicker
                label="SoH Estimation R² (DVG-BiLSTM)"
                value={batteryHealth.metrics.soh_r2}
                decimals={4}
                accent={COLORS.violet}
              />
            </GlassPanel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GlassPanel accent={COLORS.amber} style={{ padding: 22 }}>
              <MetricTicker
                label="Fault Classification Accuracy"
                value={faultDetection.baseline_comparison[1].accuracy_pct}
                decimals={2}
                suffix="%"
                accent={COLORS.amber}
              />
            </GlassPanel>
          </motion.div>
          <motion.div variants={fadeUp}>
            <GlassPanel accent={COLORS.mint} style={{ padding: 22 }}>
              <MetricTicker label="Price-Sensitivity Ratio" value={1835} suffix="×" accent={COLORS.mint} />
            </GlassPanel>
          </motion.div>
          <motion.div variants={fadeUp} className="col-span-2">
            <GlassPanel accent={COLORS.cyan} style={{ padding: 22 }}>
              <MetricTicker
                label="Solar Forecast R² (AK-VMD+QLightGBM, Daytime)"
                value={0.9815}
                decimals={4}
                accent={COLORS.cyan}
                sub="820 daytime hours, held-out test split"
              />
            </GlassPanel>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className="grid gap-5 md:grid-cols-4"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
      >
        {CAPABILITIES.map((c) => (
          <motion.div key={c.title} variants={fadeUp}>
            <GlassPanel accent={c.accent} style={{ padding: 22, height: "100%" }}>
              <c.icon size={20} color={c.accent} strokeWidth={1.7} />
              <div className="mt-3 font-display text-[15.5px] font-semibold" style={{ color: COLORS.text }}>
                {c.title}
              </div>
              <div className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: COLORS.muted }}>
                {c.desc}
              </div>
            </GlassPanel>
          </motion.div>
        ))}
      </motion.div>
    </>
  );
}
