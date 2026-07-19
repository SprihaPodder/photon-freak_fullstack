"use client";

import { useState, useRef } from "react";
import { Upload, Download, AlertCircle, CheckCircle, TrendingDown, Zap } from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import { COLORS } from "@/lib/constants";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface BatteryPredictionResult {
  battery_id: string | null;
  n_cycles_received: number;
  latest_cycle: number;
  soh_percent: number;
  soh_std: number;
  soh_ci_95: [number, number];
  health_class: string;
  rul_relative_pct: number;
  rue_relative_pct: number;
  rul_reference_range_cycles: [number, number];
  eol_70_estimate: {
    already_crossed: boolean;
    cycles_remaining: number;
    projected_cycle: number;
  } | null;
  early_warning_80: {
    already_crossed: boolean;
    cycles_remaining: number;
    projected_cycle: number;
  } | null;
  mc_samples: number;
  warnings: string[];
  out_of_distribution: boolean;
}

export default function BatteryHealthForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BatteryPredictionResult | null>(null);
  const [explanation, setExplanation] = useState("");
  const [explainLoading, setExplainLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    try {
      const res = await fetch(`${API}/api/battery/csv-template`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "battery_template.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      setError(`Failed to download template: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "text/csv") {
      setFile(selected);
      setError("");
    } else {
      setError("Please select a valid CSV file");
      setFile(null);
    }
  };

  const handlePredict = async () => {
    if (!file) {
      setError("Please select a CSV file");
      return;
    }

    setLoading(true);
    setError("");
    setExplanation("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/api/battery/predict`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const data: BatteryPredictionResult = await res.json();
      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!result) return;
    setExplainLoading(true);
    try {
      const res = await fetch(`${API}/api/battery/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction: result }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setExplanation(data.explanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Explanation failed");
    } finally {
      setExplainLoading(false);
    }
  };

  const healthColor =
    result?.health_class === "Healthy"
      ? COLORS.mint
      : result?.health_class === "Degraded"
        ? COLORS.yellow
        : COLORS.red;

  return (
    <section id="battery-health-predictor" className="mt-5 scroll-mt-6">
      <GlassPanel accent={COLORS.violet} style={{ padding: 24 }}>
        <div className="glass-eyebrow" style={{ color: COLORS.violet }}>
          <Zap size={13} /> Battery Health Predictor — Upload Cycle Data
        </div>

        {/* Upload Section */}
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <label className="flex-1">
              <div
                className="cursor-pointer rounded border-2 border-dashed p-4 text-center transition hover:bg-white/5"
                style={{
                  borderColor: file ? COLORS.mint : COLORS.border,
                  background: file ? "rgba(34, 197, 94, 0.05)" : "transparent",
                }}
              >
                <Upload size={16} className="mx-auto mb-2" />
                <span className="text-sm" style={{ color: COLORS.muted }}>
                  {file ? file.name : "Click to select CSV or drag & drop"}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <button
              onClick={downloadTemplate}
              className="px-3 py-2 rounded text-sm transition"
              style={{
                background: COLORS.border,
                color: COLORS.muted,
              }}
              title="Download CSV template"
            >
              <Download size={14} />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePredict}
              disabled={!file || loading}
              className="flex-1 rounded px-3 py-2 text-sm font-medium transition disabled:opacity-50"
              style={{
                background: COLORS.violet,
                color: COLORS.text,
              }}
            >
              {loading ? "Predicting..." : "Predict Health"}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 rounded p-3 flex gap-2" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
            <AlertCircle size={16} style={{ color: COLORS.red, flexShrink: 0 }} />
            <span style={{ color: COLORS.red, fontSize: "0.875rem" }}>{error}</span>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.22)" }}>
                <div className="text-xs" style={{ color: COLORS.muted }}>
                  Health Class
                </div>
                <div className="mt-1 font-mono text-lg flex items-center gap-2">
                  {result.health_class === "Healthy" && <CheckCircle size={16} style={{ color: healthColor }} />}
                  {result.health_class !== "Healthy" && (
                    <AlertCircle size={16} style={{ color: healthColor }} />
                  )}
                  <span style={{ color: healthColor }}>{result.health_class}</span>
                </div>
              </div>

              <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.22)" }}>
                <div className="text-xs" style={{ color: COLORS.muted }}>
                  State of Health (SoH)
                </div>
                <div className="mt-1 font-mono text-lg" style={{ color: COLORS.text }}>
                  {result.soh_percent.toFixed(2)}% ± {result.soh_std.toFixed(3)}%
                </div>
                <div className="mt-1 text-xs" style={{ color: COLORS.muted }}>
                  95% CI: [{result.soh_ci_95[0].toFixed(2)}, {result.soh_ci_95[1].toFixed(2)}]%
                </div>
              </div>

              <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.22)" }}>
                <div className="text-xs" style={{ color: COLORS.muted }}>
                  Cycles Analyzed
                </div>
                <div className="mt-1 font-mono text-lg" style={{ color: COLORS.text }}>
                  {result.n_cycles_received} cycles (latest: #{result.latest_cycle})
                </div>
              </div>

              <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.22)" }}>
                <div className="text-xs" style={{ color: COLORS.muted }}>
                  Relative Remaining Life
                </div>
                <div className="mt-1 font-mono text-lg" style={{ color: COLORS.text }}>
                  {result.rul_relative_pct.toFixed(1)}%
                </div>
              </div>

              {result.eol_70_estimate && !result.eol_70_estimate.already_crossed && (
                <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.22)" }}>
                  <div className="text-xs" style={{ color: COLORS.muted }}>
                    Projected EOL (70% SoH)
                  </div>
                  <div className="mt-1 font-mono text-lg" style={{ color: COLORS.text }}>
                    ~{result.eol_70_estimate.cycles_remaining.toFixed(0)} cycles
                  </div>
                  <div className="mt-1 text-xs" style={{ color: COLORS.muted }}>
                    Cycle #{result.eol_70_estimate.projected_cycle.toFixed(0)}
                  </div>
                </div>
              )}

              {result.early_warning_80 && !result.early_warning_80.already_crossed && (
                <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.22)" }}>
                  <div className="text-xs" style={{ color: COLORS.muted }}>
                    Maintenance Warning (80% SoH)
                  </div>
                  <div className="mt-1 font-mono text-lg" style={{ color: COLORS.text }}>
                    ~{result.early_warning_80.cycles_remaining.toFixed(0)} cycles
                  </div>
                  <div className="mt-1 text-xs" style={{ color: COLORS.muted }}>
                    Cycle #{result.early_warning_80.projected_cycle.toFixed(0)}
                  </div>
                </div>
              )}
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="mt-4 rounded p-3" style={{ background: "rgba(239, 108, 0, 0.1)" }}>
                <div className="text-xs font-medium" style={{ color: COLORS.yellow }}>
                  ⚠ Warnings:
                </div>
                <ul className="mt-2 space-y-1">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-xs" style={{ color: COLORS.yellow }}>
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Explanation Button */}
            <button
              onClick={handleExplain}
              disabled={explainLoading}
              className="mt-4 w-full rounded px-3 py-2 text-sm font-medium transition disabled:opacity-50"
              style={{
                background: COLORS.border,
                color: COLORS.text,
              }}
            >
              {explainLoading ? "Generating Explanation..." : "Get AI Explanation"}
            </button>

            {/* Explanation */}
            {explanation && (
              <div className="mt-3 rounded p-3" style={{ background: "rgba(0,0,0,.3)" }}>
                <div className="text-xs" style={{ color: COLORS.muted }}>
                  AI-Generated Explanation
                </div>
                <div className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.text }}>
                  {explanation}
                </div>
              </div>
            )}
          </>
        )}
      </GlassPanel>
    </section>
  );
}
