"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { COLORS } from "@/lib/constants";

interface ModelDatum {
  name: string;
  accuracy_pct: number;
}

/**
 * Horizontal bar comparison — used for both the AK-VMD baseline/ablation
 * comparison and the SolarGuard-Net vs EfficientNetB0/ResNet-50/
 * InceptionV3/VGG16 comparison. Highlights the "proposed" bar.
 */
export default function ModelComparisonBars({
  data,
  highlightName,
  highlightColor = COLORS.mint,
  domain = [0, 100],
}: {
  data: ModelDatum[];
  highlightName: string;
  highlightColor?: string;
  domain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
        <XAxis type="number" domain={domain} tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: COLORS.muted, fontSize: 10.5 }} width={140} axisLine={{ stroke: COLORS.border }} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="accuracy_pct" name="Value" radius={[0, 8, 8, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.name === highlightName ? highlightColor : COLORS.muted}
              fillOpacity={d.name === highlightName ? 0.9 : 0.35}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
