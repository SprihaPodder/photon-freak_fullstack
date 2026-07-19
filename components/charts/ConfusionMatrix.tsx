"use client";

import { COLORS } from "@/lib/constants";

interface ConfusionMatrixProps {
  labels: string[];
  matrix: number[][];
  max?: number;
}

/**
 * Renders an NxN confusion matrix as a heat-tinted grid. Used for the
 * DVG-BiLSTM 3-class (Healthy/Degraded/Critical) health-state result.
 */
export default function ConfusionMatrix({ labels, matrix, max = 120 }: ConfusionMatrixProps) {
  return (
    <div
      className="mt-2.5 grid gap-1.5"
      style={{ gridTemplateColumns: `70px repeat(${labels.length}, 1fr)` }}
    >
      <div />
      {labels.map((l) => (
        <div key={l} className="text-center font-mono text-[10px]" style={{ color: COLORS.muted }}>
          {l}
        </div>
      ))}
      {matrix.map((row, ri) => (
        <div key={ri} style={{ display: "contents" }}>
          <div className="flex items-center font-mono text-[10px]" style={{ color: COLORS.muted }}>
            {labels[ri]}
          </div>
          {row.map((v, ci) => {
            const isDiag = ri === ci;
            const intensity = Math.min(1, v / max);
            return (
              <div
                key={ci}
                className="flex h-[52px] items-center justify-center rounded-[10px] font-mono text-[15px] font-semibold"
                style={{
                  background: isDiag
                    ? `rgba(92,242,192,${0.15 + intensity * 0.55})`
                    : `rgba(255,180,84,${0.06 + intensity * 0.3})`,
                  border: `1px solid ${isDiag ? COLORS.mint + "55" : COLORS.border}`,
                  color: isDiag ? COLORS.mint : COLORS.text,
                }}
              >
                {v}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
