"use client";

import { motion } from "framer-motion";
import { COLORS } from "@/lib/constants";
import { fadeUp } from "@/lib/animations";
import StatusPulse, { LiveBadge } from "./StatusPulse";

interface SectionHeaderProps {
  title: string;
  subtitle: string;
}

/**
 * Standard page header: live badge, big display title, subtitle, and
 * the status/clock cluster — reused on every route.
 */
export default function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={fadeUp}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <LiveBadge />
        <h1
          className="font-display font-bold leading-none tracking-tight"
          style={{ fontSize: "clamp(30px,4vw,48px)", color: COLORS.text, letterSpacing: "-1px" }}
        >
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-[14.5px]" style={{ color: COLORS.muted }}>
          {subtitle}
        </p>
      </div>
      <StatusPulse />
    </motion.div>
  );
}
