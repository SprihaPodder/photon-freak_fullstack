"use client";

import { COLORS } from "@/lib/constants";

/**
 * Shared Recharts tooltip renderer used by every chart component so
 * tooltips share one glass style.
 */
export default function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-[10px] px-3 py-2 font-mono text-[11.5px]"
      style={{ background: COLORS.panelSolid, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
    >
      <div className="mb-1" style={{ color: COLORS.muted }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(3) : p.value}
        </div>
      ))}
    </div>
  );
}
