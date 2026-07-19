"use client";

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { COLORS } from "@/lib/constants";

interface ForecastPoint {
  label: string;
  q025: number;
  q50: number;
  q975: number;
  range: [number, number];
}

interface ForecastIntervalChartProps {
  data: ForecastPoint[];
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point: ForecastPoint = payload[0].payload;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-[12px] font-mono"
      style={{ background: COLORS.panelSolid, borderColor: COLORS.borderHi, color: COLORS.text }}
    >
      <div style={{ color: COLORS.muted }}>{label}</div>
      <div style={{ color: COLORS.amber, fontWeight: 600 }}>q50 · {point.q50.toFixed(1)}</div>
      <div style={{ color: COLORS.muted }}>
        q0.025–q0.975 · {point.q025.toFixed(1)} – {point.q975.toFixed(1)}
      </div>
    </div>
  );
}

/**
 * Prediction-interval trend across a session of submitted readings —
 * amber band for the q05-q95 range, solid line for the q50 forecast.
 */
export default function ForecastIntervalChart({ data }: ForecastIntervalChartProps) {
  const allValues = data.flatMap((d) => [d.q05, d.q50, d.q95]);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const pad = (maxVal - minVal) * 0.15 || 10;
  const yDomain: [number, number] = [Math.max(0, minVal - pad), maxVal + pad];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={COLORS.border} strokeOpacity={0.6} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: COLORS.muted }}
          axisLine={{ stroke: COLORS.border }}
          tickLine={false}
        />
        <YAxis
          domain={yDomain}
          tick={{ fontSize: 11, fill: COLORS.muted }}
          axisLine={{ stroke: COLORS.border }}
          tickLine={false}
          width={56}
          tickFormatter={(v) => Math.round(v).toString()}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: COLORS.borderHi, strokeWidth: 1 }} />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value) => <span style={{ color: COLORS.muted, fontSize: 11.5 }}>{value}</span>}
        />
        <Area
          dataKey="range"
          name="q05–q95 interval"
          stroke={COLORS.amber}
          strokeOpacity={0.4}
          strokeWidth={1}
          fill={COLORS.amber}
          fillOpacity={0.22}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="q50"
          name="q50 forecast"
          stroke={COLORS.amber}
          strokeWidth={2.5}
          dot={{ r: 4, fill: COLORS.amber, strokeWidth: 2, stroke: COLORS.void }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

