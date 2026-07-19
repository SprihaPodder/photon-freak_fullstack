"use client";

import { useCountUp } from "@/hooks/useCountUp";
import { COLORS } from "@/lib/constants";

interface MetricTickerProps {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  accent?: string;
  sub?: string;
  active?: boolean;
  duration?: number;
}

/**
 * A big animated number with a label underneath — the atomic unit of
 * every headline stat block on the dashboard.
 */
export default function MetricTicker({
  label,
  value,
  decimals = 0,
  suffix = "",
  accent = COLORS.cyan,
  sub,
  active = true,
  duration,
}: MetricTickerProps) {
  const animated = useCountUp(value, duration, active);
  return (
    <div>
      <div className="font-mono text-[30px] font-semibold leading-none" style={{ color: COLORS.text }}>
        <span style={{ color: accent }}>
          {animated.toFixed(decimals)}
          {suffix}
        </span>
      </div>
      <div className="mt-1.5 text-[12.5px]" style={{ color: COLORS.muted }}>
        {label}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] opacity-70" style={{ color: COLORS.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}
