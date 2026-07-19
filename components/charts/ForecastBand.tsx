"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Tooltip,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { COLORS } from "@/lib/constants";

interface Datum {
  name: string;
  r2: number;
}

/**
 * Model R² comparison bar chart — used on the Forecasting page to
 * compare CNN-LSTM-Transformer against AK-VMD+QLightGBM (all-hours
 * and daytime).
 */
export default function ForecastBand({ data, colors }: { data: Datum[]; colors: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
        <YAxis domain={[0, 1]} tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="r2" name="R²" radius={[8, 8, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
