"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Zap, Sun, CircuitBoard } from "lucide-react";

import SectionHeader from "@/components/ui/SectionHeader";
import GlassPanel from "@/components/ui/GlassPanel";
import MetricTicker from "@/components/ui/MetricTicker";
import ChartTooltip from "@/components/charts/ChartTooltip";
import { COLORS } from "@/lib/constants";
import ChargingInputForm from "@/components/ChargingInputForm";

import chargingOptimizer from "@/lib/data/charging-optimizer.json";
import vmd from "@/lib/data/vmd-lightgbm.json";

const optimizerVs = [
  { metric: "Total Cost (₹)", baseline: 195.2, optimized: 131.54 },
  { metric: "Active Intervals (%)", baseline: 100, optimized: 52 },
  { metric: "Solar-Coincident (%)", baseline: 8, optimized: 34.1 },
];

const evSignalDist = vmd.ev_charging_signal.tiers.map((t, i) => ({
  name: t.name,
  value: t.share_pct,
  color: [COLORS.mint, COLORS.cyan, COLORS.muted][i],
}));

const paramRows: [string, string][] = [
  ["Horizon", chargingOptimizer.parameters.horizon],
  ["Battery Capacity", `${chargingOptimizer.parameters.battery_capacity_kwh} kWh`],
  ["Max Charging Power", `${chargingOptimizer.parameters.max_charging_power_kw} kW`],
  ["Initial → Target SoC", `${chargingOptimizer.parameters.initial_soc_pct}% → ${chargingOptimizer.parameters.target_soc_pct}%`],
  ["C-rate Range", chargingOptimizer.parameters.c_rate_range],
  ["Temperature Limit", `${chargingOptimizer.parameters.temperature_limit_c}°C`],
  ["Grid Price Range", `₹${chargingOptimizer.parameters.grid_price_range_inr_per_kwh} /kWh`],
  ["PSO Swarm / GA Pop", `${chargingOptimizer.parameters.pso_swarm} / ${chargingOptimizer.parameters.ga_population}`],
];

export default function ChargingPage() {
  return (
    <>
      <SectionHeader
        title="Battery-Aware EV Charging Optimization"
        subtitle="A multi-objective PSO-GA scheduler couples grid cost, solar utilization, and SoH-conditioned degradation into one 75-hour decision horizon."
      />
      <button onClick={() => document.getElementById("charging-optimizer")?.scrollIntoView({ behavior: "smooth" })} className="mb-5 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: COLORS.mint, color: COLORS.mint }}>Optimise your own charging plan ↓</button>

      <div className="mb-5 grid gap-5 md:grid-cols-4">
        <GlassPanel accent={COLORS.mint} style={{ padding: 20 }}>
          <MetricTicker label="Cost Reduction vs Uniform" value={20} suffix="%" accent={COLORS.mint} />
        </GlassPanel>
        <GlassPanel accent={COLORS.mint} style={{ padding: 20 }}>
          <MetricTicker label="Price-Sensitivity Ratio" value={1835} suffix="×" accent={COLORS.mint} />
        </GlassPanel>
        <GlassPanel accent={COLORS.cyan} style={{ padding: 20 }}>
          <MetricTicker label="Solar-Coincident Energy" value={34.1} decimals={1} suffix="%" accent={COLORS.cyan} />
        </GlassPanel>
        <GlassPanel accent={COLORS.cyan} style={{ padding: 20 }}>
          <MetricTicker label="Idle Intervals Avoided" value={48} suffix="%" accent={COLORS.cyan} />
        </GlassPanel>
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <GlassPanel accent={COLORS.mint} style={{ padding: 24, height: 320 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.mint }}>
            <Zap size={13} /> PSO-GA vs Uniform Baseline
          </div>
          <div style={{ height: "86%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={optimizerVs} margin={{ top: 14, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="metric" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: COLORS.muted }} />
                <Bar dataKey="baseline" name="Baseline" fill={COLORS.muted} fillOpacity={0.4} radius={[8, 8, 0, 0]} />
                <Bar dataKey="optimized" name="Optimized" fill={COLORS.mint} fillOpacity={0.9} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel accent={COLORS.cyan} style={{ padding: 24, height: 320 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
            <Sun size={13} /> 3-Tier Solar Charging Signal (Paper 2)
          </div>
          <div style={{ height: "86%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={evSignalDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {evSignalDist.map((d, i) => (
                    <Cell key={i} fill={d.color} fillOpacity={0.88} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: COLORS.muted }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11.5px]" style={{ color: COLORS.muted }}>
            Classification accuracy {vmd.metrics.classification_acc_pct}%. {vmd.ev_charging_signal.false_negatives_hours}{" "}
            false negatives → {vmd.ev_charging_signal.unutilized_solar_kwh} kWh unutilized solar (~₹
            {vmd.ev_charging_signal.estimated_extra_cost_inr}/sim).
          </div>
        </GlassPanel>
      </div>

      <GlassPanel accent={COLORS.violet} style={{ padding: 22 }}>
        <div className="glass-eyebrow" style={{ color: COLORS.violet }}>
          <CircuitBoard size={13} /> Optimization Problem Parameters
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          {paramRows.map(([k, v]) => (
            <div key={k} style={{ borderLeft: `2px solid ${COLORS.violet}55`, paddingLeft: 10 }}>
              <div className="text-[10.5px] uppercase tracking-wide" style={{ color: COLORS.muted }}>{k}</div>
              <div className="mt-0.5 font-mono text-[13.5px]" style={{ color: COLORS.text }}>{v}</div>
            </div>
          ))}
        </div>
      </GlassPanel>
      <ChargingInputForm />
    </>
  );
}
