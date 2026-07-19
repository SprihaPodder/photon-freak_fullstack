"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";

/**
 * Boots a single Lenis smooth-scroll instance for the app and exposes
 * scroll progress (0–1) so R3F camera rigs / parallax layers can react
 * to it. Mount once in the root layout.
 */
export function useScrollCamera() {
  const lenisRef = useRef<Lenis | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ({ progress: p }: { progress: number }) => {
      setProgress(p);
    });

    let raf: number;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return { progress, lenis: lenisRef };
}
