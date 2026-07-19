"use client";

import { useRef, useState, MouseEvent } from "react";

/**
 * Gives any element a subtle "magnetic" pull toward the cursor.
 * Spread the returned handlers + style onto the target element.
 */
export function useMagneticHover(strength = 0.35) {
  const ref = useRef<HTMLElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMouseMove = (e: MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    setOffset({ x: x * strength, y: y * strength });
  };

  const onMouseLeave = () => setOffset({ x: 0, y: 0 });

  return {
    ref,
    onMouseMove,
    onMouseLeave,
    style: {
      transform: `translate(${offset.x}px, ${offset.y}px)`,
      transition: "transform 0.35s cubic-bezier(.2,.8,.2,1)",
    },
  };
}
