"use client";

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { COLORS } from "@/lib/constants";

interface SensitivityPoint {
  k: string;
  r2_daytime: number;
}

/**
 * K-sensitivity line — shows why fixed K=3 (used in 100% of prior
 * VMD-solar literature) underperforms the entropy-NRMSE-selected
 * Adaptive K=6.
 */
export default function VMDModeStack({ data }: { data: SensitivityPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 14, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="k" tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
        <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
        <Line
          type="monotone"
          dataKey="r2_daytime"
          name="R² (daytime)"
          stroke={COLORS.amber}
          strokeWidth={2.5}
          dot={{ r: 4, fill: COLORS.amber }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
