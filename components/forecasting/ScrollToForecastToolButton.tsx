"use client";

import { Sun, ArrowRight } from "lucide-react";
import { COLORS } from "@/lib/constants";

/**
 * Place this near the top of the Forecasting page (e.g. right under
 * SectionHeader). Clicking it smooth-scrolls down to the live forecast
 * tool section, which must have id="live-forecast-tool" (already set on
 * LiveForecastGrid's wrapper div).
 */
export default function ScrollToForecastToolButton() {
  function scrollToTool() {
    document.getElementById("live-forecast-tool")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button
      onClick={scrollToTool}
      className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium shadow-lg transition-opacity hover:opacity-90"
      style={{ background: COLORS.amber, color: COLORS.void }}
    >
      <Sun size={14} /> Start using it <ArrowRight size={14} />
    </button>
  );
}
