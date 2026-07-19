"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 → target with an easeOutCubic curve.
 * Re-fires whenever `active` flips true (e.g. panel scrolls into view).
 */
export function useCountUp(
  target: number,
  duration = 1400,
  active = true
): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!active) return;
    let start: number | null = null;

    const step = (t: number) => {
      if (start === null) start = t;
      const progress = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, active]);

  return value;
}
