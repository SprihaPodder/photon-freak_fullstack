"use client";

import { ReactNode, useRef, useState, MouseEvent } from "react";
import { motion } from "framer-motion";
import { COLORS } from "@/lib/constants";

interface GlassPanelProps {
  children: ReactNode;
  accent?: string;
  className?: string;
  style?: React.CSSProperties;
  noTilt?: boolean;
}

/**
 * The base "holographic module" surface used across every page.
 * Tilts subtly toward the cursor, lifts on hover, and carries a
 * gradient hairline that picks up the panel's accent color.
 */
export default function GlassPanel({
  children,
  accent = COLORS.cyan,
  className = "",
  style,
  noTilt = false,
}: GlassPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (noTilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -4, y: px * 6 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      whileHover={{ y: -3 }}
      className={`relative overflow-hidden rounded-[20px] border ${className}`}
      style={{
        background: COLORS.panel,
        borderColor: COLORS.border,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.02) inset, 0 20px 60px -20px rgba(0,0,0,0.6)",
        transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: "transform 0.25s cubic-bezier(.2,.8,.2,1), border-color .3s",
        ...style,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
      />
      {children}
    </motion.div>
  );
}
