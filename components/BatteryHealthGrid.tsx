"use client";

/**
 * BatteryHealthGrid
 * ==================
 * Live-inference panel for the Battery Health page. Uploads a CSV of
 * per-cycle discharge data to the DVG-BiLSTM FastAPI backend's /predict
 * endpoint and renders SoH, health class, MC-Dropout uncertainty band,
 * relative RUL/RUE, and trend-based end-of-life projections — styled to
 * match the rest of the dashboard's glass panel system.
 *
 * Usage:
 *   <BatteryHealthGrid apiBaseUrl={process.env.NEXT_PUBLIC_BATTERY_API_URL} />
 *
 * Required CSV columns (one row per discharge cycle, oldest first):
 *   cycle, Capacity, chI, chV, chT, disI, disV, disT, BCt,
 *   disV_min, disV_max, disV_range, dis_energy, Re, Rct
 *
 * Template download: GET {apiBaseUrl}/csv-template
 *
 * Scroll target: this component's outer panel has id="csv-upload-section" so
 * other parts of the page (e.g. a "Jump to upload" button in the page header)
 * can scroll to it — see ScrollToUploadButton.tsx.
 */

import { useState, useCallback, ChangeEvent, FormEvent } from "react";
import { BatteryMedium, UploadCloud, Download, Sparkles } from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import { COLORS, SOH_BANDS } from "@/lib/constants";

interface TrendCrossing {
  already_crossed: boolean;
  cycles_remaining: number;
  projected_cycle: number;
}

interface PredictionResponse {
  battery_id?: string;
  n_cycles_received: number;
  latest_cycle: number;
  soh_percent: number;
  soh_std: number;
  soh_ci_95: [number, number];
  health_class: "Healthy" | "Degraded" | "Critical";
  rul_relative_pct: number;
  rue_relative_pct: number;
  rul_reference_range_cycles: [number, number];
  eol_70_estimate: TrendCrossing | null;
  early_warning_80: TrendCrossing | null;
  mc_samples: number;
  out_of_distribution: boolean;
  warnings: string[];
}

function healthColor(cls: PredictionResponse["health_class"]) {
  if (cls === "Healthy") return SOH_BANDS.healthy.color;
  if (cls === "Degraded") return SOH_BANDS.degraded.color;
  return SOH_BANDS.critical.color;
}

function StatBlock({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div
      className="rounded-[14px] p-3.5"
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${COLORS.border}` }}
    >
      <div className="text-[11px]" style={{ color: COLORS.muted }}>
        {label}
      </div>
      <div className="mt-1 font-mono text-[19px] font-semibold" style={{ color: accent }}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10.5px] opacity-70" style={{ color: COLORS.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function TrendRow({ label, trend }: { label: string; trend: TrendCrossing | null }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[12.5px]" style={{ borderTop: `1px solid ${COLORS.border}` }}>
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span className="font-mono" style={{ color: COLORS.text }}>
        {!trend
          ? "stable / not degrading"
          : trend.already_crossed
          ? "already crossed"
          : `~${trend.cycles_remaining} cyc → #${trend.projected_cycle}`}
      </span>
    </div>
  );
}

/**
 * Minimal markdown-lite renderer for the Groq explanation text. Handles just
 * the two things explainability.py's system prompt is instructed to produce:
 * **bold** spans and "- " bullet lines. Deliberately not a full markdown
 * parser / no external dependency — just enough to make the model's output
 * render cleanly instead of showing literal asterisks and dashes.
 */
function renderInlineBold(line: string, keyPrefix: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`} style={{ color: COLORS.text, fontWeight: 700 }}>
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

function ExplanationText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/); // split on blank lines -> paragraphs/lists

  return (
    <div className="space-y-3">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every((l) => l.startsWith("- "));

        if (isList) {
          return (
            <ul key={bi} className="ml-4 list-disc space-y-1">
              {lines.map((l, li) => (
                <li key={li}>{renderInlineBold(l.replace(/^- /, ""), `b${bi}l${li}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <span key={li}>
                {renderInlineBold(l, `b${bi}l${li}`)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function BatteryHealthGrid({ apiBaseUrl = "http://localhost:8000" }: { apiBaseUrl?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [batteryId, setBatteryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
    setExplanation(null);
    setExplainError(null);
  }, []);

  const handleExplain = useCallback(async (prediction: PredictionResponse) => {
    setExplaining(true);
    setExplainError(null);
    setExplanation(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/battery/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setExplanation(data.explanation);
    } catch (err: any) {
      setExplainError(err.message || "Could not generate an explanation.");
    } finally {
      setExplaining(false);
    }
  }, [apiBaseUrl]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!file) {
        setError("Choose a CSV file first.");
        return;
      }
      setLoading(true);
      setError(null);
      setResult(null);
      setExplanation(null);
      setExplainError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (batteryId) formData.append("battery_id", batteryId);

        const res = await fetch(`${apiBaseUrl}/api/battery/predict`, { method: "POST", body: formData });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.detail || `Request failed (${res.status})`);
        }
        const prediction: PredictionResponse = await res.json();
        setResult(prediction);
        handleExplain(prediction); // fire immediately, don't wait for user to click anything
      } catch (err: any) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [file, batteryId, apiBaseUrl, handleExplain]
  );

  const accent = result ? healthColor(result.health_class) : COLORS.violet;

  return (
    <div id="csv-upload-section" style={{ scrollMarginTop: 96 }}>
    <GlassPanel accent={accent} style={{ padding: 24 }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="glass-eyebrow" style={{ color: COLORS.violet }}>
          <BatteryMedium size={13} /> Live SoH Estimator — Upload Cycle History
        </div>
        <a
          href={`${apiBaseUrl}/api/battery/csv-template`}
          download="battery_template.csv"
          className="flex items-center gap-1 text-[11px] font-medium hover:opacity-80"
          style={{ color: COLORS.cyan }}
        >
          <Download size={12} /> CSV template
        </a>
      </div>

      <div
        className="mb-4 rounded-[10px] px-3 py-2 text-[11px]"
        style={{ background: "rgba(140,170,255,0.05)", border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
      >
        ⚠ Calibrated for <strong style={{ color: COLORS.text }}>lithium-ion cells only</strong> (18650-format,
        trained on 7 batteries total). Not validated for other chemistries or battery formats — see the
        out-of-range warning below if your readings fall outside what this model has learned from.
      </div>

      <form onSubmit={handleSubmit} className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px]" style={{ color: COLORS.muted }}>
            Battery ID (optional)
          </label>
          <input
            type="text"
            value={batteryId}
            onChange={(e) => setBatteryId(e.target.value)}
            placeholder="CELL-042"
            className="rounded-[10px] bg-transparent px-2.5 py-1.5 text-[13px] outline-none"
            style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px]" style={{ color: COLORS.muted }}>
            Cycle history CSV
          </label>
          <label
            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-3 py-1.5 text-[12.5px] transition hover:opacity-85"
            style={{ border: `1px solid ${COLORS.borderHi}`, color: COLORS.text }}
          >
            <UploadCloud size={13} style={{ color: COLORS.cyan }} />
            {file ? file.name : "Choose file"}
            <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-[10px] px-4 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: COLORS.violet, color: "#05070c" }}
        >
          {loading ? "Running inference…" : "Estimate health"}
        </button>
      </form>

      {error && (
        <div
          className="mb-4 rounded-[10px] px-3 py-2 text-[12.5px]"
          style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.3)", color: "#ff8a8a" }}
        >
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.out_of_distribution && (
            <div
              className="rounded-[10px] px-3 py-2.5 text-[12px]"
              style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.4)", color: "#ff9a9a" }}
            >
              <strong>⚠ Outside trained range.</strong> One or more of this battery's readings fall outside
              anything the model saw during training (only 7 batteries total). This prediction is an
              extrapolation — treat it with reduced confidence. See details below.
            </div>
          )}

          {/* SoH headline + health badge */}
          <div
            className="flex items-center justify-between rounded-[14px] p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${COLORS.border}` }}
          >
            <div>
              <div className="text-[11px]" style={{ color: COLORS.muted }}>
                {result.battery_id ? `${result.battery_id} · ` : ""}cycle {result.latest_cycle} ·{" "}
                {result.n_cycles_received} cycles analyzed
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-[32px] font-semibold leading-none" style={{ color: accent }}>
                  {result.soh_percent.toFixed(1)}%
                </span>
                <span className="text-[13px]" style={{ color: COLORS.muted }}>
                  SoH
                </span>
              </div>
              <div className="mt-1 text-[11px]" style={{ color: COLORS.muted }}>
                95% CI: {result.soh_ci_95[0].toFixed(1)}%–{result.soh_ci_95[1].toFixed(1)}% (±
                {(2 * result.soh_std).toFixed(2)}%, {result.mc_samples} MC-Dropout passes)
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[12.5px] font-semibold"
              style={{ color: accent, background: `${accent}1a`, border: `1px solid ${accent}55` }}
            >
              {result.health_class}
            </span>
          </div>

          {/* SoH confidence band */}
          <div>
            <div className="mb-1.5 flex justify-between text-[10.5px]" style={{ color: COLORS.muted }}>
              <span>0%</span>
              <span>SoH confidence band</span>
              <span>100%</span>
            </div>
            <div className="relative h-2.5 w-full rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="absolute h-2.5 rounded-full"
                style={{
                  left: `${result.soh_ci_95[0]}%`,
                  width: `${result.soh_ci_95[1] - result.soh_ci_95[0]}%`,
                  background: `${accent}55`,
                }}
              />
              <div
                className="absolute h-2.5 w-[3px] rounded-full"
                style={{ left: `calc(${result.soh_percent}% - 1.5px)`, background: accent }}
              />
            </div>
          </div>

          {/* Relative RUL / RUE */}
          <div className="grid grid-cols-2 gap-3">
            <StatBlock
              label="Relative RUL"
              value={`${result.rul_relative_pct.toFixed(1)}%`}
              sub={`ref. (NASA cells): ${result.rul_reference_range_cycles[0]}–${result.rul_reference_range_cycles[1]} cyc`}
              accent={COLORS.cyan}
            />
            <StatBlock
              label="Relative RUE"
              value={`${result.rue_relative_pct.toFixed(1)}%`}
              sub="% of learned remaining-energy scale"
              accent={COLORS.cyan}
            />
          </div>

          {/* Trend-based EOL projections */}
          <div>
            <div className="mb-0.5 text-[11px]" style={{ color: COLORS.muted }}>
              Projected from recent degradation trend
            </div>
            <TrendRow label="Second-life trigger (80% SoH)" trend={result.early_warning_80} />
            <TrendRow label="End-of-life (70% SoH)" trend={result.eol_70_estimate} />
          </div>

          {result.warnings?.length > 0 && (
            <div
              className="rounded-[10px] px-3 py-2 text-[11px]"
              style={{ background: "rgba(255,180,84,0.08)", border: "1px solid rgba(255,180,84,0.3)", color: COLORS.amber }}
            >
              {result.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          {/* Plain-English explanation via Groq — generates automatically, no click needed */}
          <div>
            {explaining && (
              <div className="flex items-center gap-2 text-[12px]" style={{ color: COLORS.muted }}>
                <Sparkles size={13} style={{ color: COLORS.cyan }} className="animate-pulse" />
                Generating plain-English explanation…
              </div>
            )}

            {explainError && (
              <div className="text-[11.5px]" style={{ color: "#ff9a9a" }}>
                Explanation unavailable: {explainError}
              </div>
            )}

            {explanation && (
              <div
                className="rounded-[14px] p-4 text-[13px] leading-relaxed"
                style={{ background: "rgba(140,170,255,0.05)", border: `1px solid ${COLORS.border}`, color: COLORS.text }}
              >
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: COLORS.cyan }}>
                  <Sparkles size={12} /> Plain-English explanation
                </div>
                <ExplanationText text={explanation} />
              </div>

            )}
          </div>
        </div>
      )}
    </GlassPanel>
    </div>
  );
}
