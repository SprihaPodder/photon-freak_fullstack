"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { COLORS } from "@/lib/constants";

interface SweepPoint {
  soh_pct: number;
  active_charging_pct: number;
  final_soc_pct: number;
}

/**
 * Shows how the SoH-conditioned power ceiling reshapes the charging
 * schedule: active-charging share and final SoC across the SoH sweep
 * (100% / 90% / 80% / 70%).
 */
export default function SoCScheduleChart({ data }: { data: SweepPoint[] }) {
  const chartData = data.map((d) => ({
    soh: `${d.soh_pct}%`,
    active: d.active_charging_pct,
    finalSoc: d.final_soc_pct,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 14, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="soh" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
        <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} unit="%" />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="active" name="Active Charging %" radius={[8, 8, 0, 0]} fill={COLORS.cyan} fillOpacity={0.85} />
        <Bar dataKey="finalSoc" name="Final SoC %" radius={[8, 8, 0, 0]} fill={COLORS.mint} fillOpacity={0.55} />
      </BarChart>
    </ResponsiveContainer>
  );
}
