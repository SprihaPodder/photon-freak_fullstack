import type { Variants } from "framer-motion";

// Shared Framer Motion variants used across pages/components so every
// module enters with the same cinematic rhythm.

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  }),
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

export const panelHover = {
  rest: { scale: 1 },
  hover: { scale: 1.015, transition: { duration: 0.25, ease: [0.2, 0.8, 0.2, 1] } },
};

export const pathDraw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.4, ease: [0.16, 1, 0.3, 1] },
  },
};

export const pulse: Variants = {
  animate: {
    scale: [1, 1.12, 1],
    opacity: [0.7, 1, 0.7],
    transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
  },
};
