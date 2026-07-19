"use client";

/**
 * ScrollToUploadButton
 * =====================
 * Small button meant for the page header (top-right) that smooth-scrolls
 * down to the CSV upload panel (BatteryHealthGrid, which has
 * id="csv-upload-section").
 *
 * Usage:
 *   <ScrollToUploadButton />
 *
 * Drop this wherever "top right" is on your page — e.g. inside your page's
 * header/nav row, next to other header controls.
 */

import { UploadCloud } from "lucide-react";
import { COLORS } from "@/lib/constants";

export default function ScrollToUploadButton({
  targetId = "csv-upload-section",
  label = "Upload data",
}: {
  targetId?: string;
  label?: string;
}) {
  const handleClick = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold transition hover:opacity-85"
      style={{ background: COLORS.violet, color: "#05070c" }}
    >
      <UploadCloud size={13} />
      {label}
    </button>
  );
}
