"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { COLORS } from "@/lib/constants";

interface Point {
  cycle: number;
  soh: number;
}

/**
 * Generates a representative logistic-decay SoH curve matching the
 * paper's reported trajectory: ~99% -> 38% over 250 cycles, crossing
 * the 70% EOL threshold at ~cycle 120.
 */
export function generateDegradationCurve(): Point[] {
  const pts: Point[] = [];
  for (let c = 0; c <= 250; c += 5) {
    const soh = 99 - 61 * (1 / (1 + Math.exp(-(c - 130) / 22)));
    pts.push({ cycle: c, soh: Number(soh.toFixed(1)) });
  }
  return pts;
}

export default function SoHTrajectory({
  data,
  eolThreshold = 70,
}: {
  data: Point[];
  eolThreshold?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 14, right: 20, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="sohGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.violet} stopOpacity={0.5} />
            <stop offset="100%" stopColor={COLORS.violet} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="cycle"
          tick={{ fill: COLORS.muted, fontSize: 10 }}
          axisLine={{ stroke: COLORS.border }}
          tickLine={false}
          label={{ value: "Discharge Cycle", position: "insideBottom", fill: COLORS.muted, fontSize: 10, dy: 10 }}
        />
        <YAxis domain={[30, 100]} tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} unit="%" />
        <Tooltip content={<ChartTooltip />} />
        <ReferenceLine
          y={eolThreshold}
          stroke={COLORS.amber}
          strokeDasharray="4 4"
          label={{ value: `EOL ${eolThreshold}%`, fill: COLORS.amber, fontSize: 10, position: "right" }}
        />
        <Area type="monotone" dataKey="soh" name="SoH" stroke={COLORS.violet} strokeWidth={2.5} fill="url(#sohGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
