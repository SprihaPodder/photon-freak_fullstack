"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { COLORS } from "@/lib/constants";
import { pulse } from "@/lib/animations";

/**
 * Live clock + "system online" heartbeat indicator, shown in every
 * page header.
 */
export default function StatusPulse() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-4 font-mono text-xs" style={{ color: COLORS.muted }}>
      <div className="flex items-center gap-1.5">
        <motion.span
          variants={pulse}
          animate="animate"
          className="h-[7px] w-[7px] rounded-full"
          style={{ background: COLORS.mint, boxShadow: `0 0 10px ${COLORS.mint}` }}
        />
        EDGE-CLOUD LINKED
      </div>
      <div>{now ? now.toLocaleTimeString([], { hour12: false }) : "--:--:--"}</div>
    </div>
  );
}

export function LiveBadge() {
  return (
    <div className="glass-eyebrow" style={{ color: COLORS.mint }}>
      <Radio size={13} /> System Online · AXIS Mission Control
    </div>
  );
}
