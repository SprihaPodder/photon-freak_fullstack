"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Network, Sun, BatteryMedium, Zap, ScanEye, CircuitBoard, LucideIcon,
} from "lucide-react";
import { COLORS } from "@/lib/constants";

interface DockItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: DockItem[] = [
  { href: "/", label: "Overview", icon: Network },
  { href: "/forecasting", label: "Forecasting", icon: Sun },
  { href: "/battery", label: "Battery Health", icon: BatteryMedium },
  { href: "/charging", label: "EV Charging", icon: Zap },
  { href: "/faults", label: "Fault Detection", icon: ScanEye },
  { href: "/system", label: "Integrated System", icon: CircuitBoard },
];

/**
 * Floating left-hand navigation dock, persistent across route changes.
 * Active route gets a glowing cyan ring + icon tint.
 */
export default function Dock() {
  const pathname = usePathname();

  return (
    <div
      className="fixed left-[22px] top-1/2 z-50 flex -translate-y-1/2 flex-col gap-1.5 rounded-[20px] p-2.5"
      style={{ background: "rgba(10,14,22,0.6)", border: `1px solid ${COLORS.border}`, backdropFilter: "blur(20px)" }}
    >
      {ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} title={item.label}>
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px]"
              style={{
                background: isActive ? "rgba(79,216,255,0.14)" : "transparent",
                boxShadow: isActive
                  ? `0 0 0 1px ${COLORS.cyan}55, 0 0 18px ${COLORS.cyan}33`
                  : "none",
                transition: "background .25s, box-shadow .25s",
              }}
            >
              <item.icon size={17} color={isActive ? COLORS.cyan : COLORS.muted} strokeWidth={1.8} />
            </motion.div>
          </Link>
        );
      })}
    </div>
  );
}
