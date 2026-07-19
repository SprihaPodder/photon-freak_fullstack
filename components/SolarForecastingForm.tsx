"use client";

import { useState, useRef } from "react";
import { Sun, Upload, TrendingUp, AlertCircle, CheckCircle, Zap } from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import { COLORS } from "@/lib/constants";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface SolarReading {
  datetime: string;
  GHI: number;
  DNI: number;
  DHI: number;
  EBH: number;
  AirTemperature: number;
  CloudOpacity: number;
  Production?: number;
}

interface SolarForecastResult {
  datetime: string;
  q025: number;
  q50: number;
  q975: number;
  vmd_best_k: number;
  rho: number;
  ev_signal: number;
  explanation: string;
}

export default function SolarForecastingForm() {
  const [bootstrapFile, setBootstrapFile] = useState<File | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapDone, setBootstrapDone] = useState(false);

  const [readingForm, setReadingForm] = useState<SolarReading>({
    datetime: new Date().toISOString().slice(0, 16),
    GHI: 500,
    DNI: 800,
    DHI: 100,
    EBH: 0.8,
    AirTemperature: 25,
    CloudOpacity: 0.2,
    Production: 0,
  });

  const [readingLoading, setReadingLoading] = useState(false);
  const [result, setResult] = useState<SolarForecastResult | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bootstrap form handlers
  const handleBootstrapFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "text/csv") {
      setBootstrapFile(selected);
      setError("");
    } else {
      setError("Please select a valid CSV file");
      setBootstrapFile(null);
    }
  };

  const handleBootstrap = async () => {
    if (!bootstrapFile) {
      setError("Please select a CSV file");
      return;
    }

    setBootstrapLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", bootstrapFile);

    try {
      const res = await fetch(`${API}/api/solar/bootstrap`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setBootstrapDone(true);
      setBootstrapFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bootstrap failed");
    } finally {
      setBootstrapLoading(false);
    }
  };

  // Reading form handlers
  const handleReadingChange = (key: keyof SolarReading, value: any) => {
    setReadingForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitReading = async () => {
    setReadingLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/api/solar/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readingForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const data: SolarForecastResult = await res.json();
      setResult(data);
      // Update datetime to next hour
      const dt = new Date(readingForm.datetime);
      dt.setHours(dt.getHours() + 1);
      setReadingForm((prev) => ({
        ...prev,
        datetime: dt.toISOString().slice(0, 16),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reading submission failed");
    } finally {
      setReadingLoading(false);
    }
  };

  const evSignalLabel =
    result?.ev_signal === 1.0 ? "Full Charge 🟢" : result?.ev_signal === 0.5 ? "Trickle Charge 🟡" : "Hold ⏹️";

  return (
    <section id="solar-forecasting" className="mt-5 space-y-5 scroll-mt-6">
      {/* Bootstrap Section */}
      <GlassPanel accent={COLORS.cyan} style={{ padding: 24 }}>
        <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
          <Sun size={13} /> Step 1: Bootstrap Historical Data
        </div>
        <p className="mt-2 text-xs" style={{ color: COLORS.muted }}>
          Upload a CSV with historical weather & production data to seed the forecasting model.
        </p>

        <div className="mt-4 space-y-3">
          <label>
            <div
              className="cursor-pointer rounded border-2 border-dashed p-4 text-center transition hover:bg-white/5"
              style={{
                borderColor: bootstrapFile ? COLORS.cyan : COLORS.border,
                background: bootstrapFile ? `rgba(34, 211, 238, 0.05)` : "transparent",
              }}
            >
              <Upload size={16} className="mx-auto mb-2" />
              <span className="text-sm" style={{ color: COLORS.muted }}>
                {bootstrapFile ? bootstrapFile.name : "Click to select CSV or drag & drop"}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleBootstrapFileSelect}
              className="hidden"
            />
          </label>

          <button
            onClick={handleBootstrap}
            disabled={!bootstrapFile || bootstrapLoading}
            className="w-full rounded px-3 py-2 text-sm font-medium transition disabled:opacity-50"
            style={{
              background: COLORS.cyan,
              color: COLORS.text,
            }}
          >
            {bootstrapLoading ? "Loading..." : "Bootstrap Model"}
          </button>

          {bootstrapDone && (
            <div className="rounded p-3 flex gap-2" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
              <CheckCircle size={16} style={{ color: COLORS.mint, flexShrink: 0 }} />
              <span style={{ color: COLORS.mint, fontSize: "0.875rem" }}>Historical data loaded successfully!</span>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Reading Submission Section */}
      <GlassPanel accent={COLORS.cyan} style={{ padding: 24 }}>
        <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
          <TrendingUp size={13} /> Step 2: Submit Hourly Readings & Get Forecast
        </div>
        <p className="mt-2 text-xs" style={{ color: COLORS.muted }}>
          Enter current weather conditions to get next-hour solar generation forecast with EV charging signals.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs" style={{ color: COLORS.muted }}>
            Datetime
            <input
              type="datetime-local"
              value={readingForm.datetime}
              onChange={(e) => handleReadingChange("datetime", e.target.value)}
              className="mt-1 block w-full rounded bg-black/25 p-2 text-sm"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </label>

          <label className="text-xs" style={{ color: COLORS.muted }}>
            GHI (W/m²)
            <input
              type="number"
              step="10"
              value={readingForm.GHI}
              onChange={(e) => handleReadingChange("GHI", parseFloat(e.target.value))}
              className="mt-1 block w-full rounded bg-black/25 p-2 text-sm"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </label>

          <label className="text-xs" style={{ color: COLORS.muted }}>
            DNI (W/m²)
            <input
              type="number"
              step="10"
              value={readingForm.DNI}
              onChange={(e) => handleReadingChange("DNI", parseFloat(e.target.value))}
              className="mt-1 block w-full rounded bg-black/25 p-2 text-sm"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </label>

          <label className="text-xs" style={{ color: COLORS.muted }}>
            DHI (W/m²)
            <input
              type="number"
              step="10"
              value={readingForm.DHI}
              onChange={(e) => handleReadingChange("DHI", parseFloat(e.target.value))}
              className="mt-1 block w-full rounded bg-black/25 p-2 text-sm"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </label>

          <label className="text-xs" style={{ color: COLORS.muted }}>
            EBH (kWh/m²)
            <input
              type="number"
              step="0.1"
              value={readingForm.EBH}
              onChange={(e) => handleReadingChange("EBH", parseFloat(e.target.value))}
              className="mt-1 block w-full rounded bg-black/25 p-2 text-sm"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </label>

          <label className="text-xs" style={{ color: COLORS.muted }}>
            Air Temp (°C)
            <input
              type="number"
              step="0.5"
              value={readingForm.AirTemperature}
              onChange={(e) => handleReadingChange("AirTemperature", parseFloat(e.target.value))}
              className="mt-1 block w-full rounded bg-black/25 p-2 text-sm"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </label>

          <label className="text-xs" style={{ color: COLORS.muted }}>
            Cloud Opacity (0-1)
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={readingForm.CloudOpacity}
              onChange={(e) => handleReadingChange("CloudOpacity", parseFloat(e.target.value))}
              className="mt-1 block w-full rounded bg-black/25 p-2 text-sm"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </label>

          <label className="text-xs" style={{ color: COLORS.muted }}>
            Production (kW, optional)
            <input
              type="number"
              step="0.1"
              value={readingForm.Production || 0}
              onChange={(e) => handleReadingChange("Production", parseFloat(e.target.value))}
              className="mt-1 block w-full rounded bg-black/25 p-2 text-sm"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            />
          </label>
        </div>

        <button
          onClick={handleSubmitReading}
          disabled={readingLoading || !bootstrapDone}
          className="mt-4 w-full rounded px-3 py-2 text-sm font-medium transition disabled:opacity-50"
          style={{
            background: COLORS.cyan,
            color: COLORS.text,
          }}
        >
          {readingLoading ? "Processing..." : "Submit Reading & Forecast"}
        </button>
      </GlassPanel>

      {/* Error Display */}
      {error && (
        <div className="rounded p-3 flex gap-2" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
          <AlertCircle size={16} style={{ color: COLORS.red, flexShrink: 0 }} />
          <span style={{ color: COLORS.red, fontSize: "0.875rem" }}>{error}</span>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <GlassPanel accent={COLORS.cyan} style={{ padding: 24 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
            <Zap size={13} /> Forecast for {new Date(result.datetime).toLocaleString()}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.22)" }}>
              <div className="text-xs" style={{ color: COLORS.muted }}>
                Median Forecast (q50)
              </div>
              <div className="mt-1 font-mono text-lg" style={{ color: COLORS.text }}>
                {result.q50.toFixed(1)} kW
              </div>
              <div className="mt-1 text-xs" style={{ color: COLORS.muted }}>
                Range: {result.q025.toFixed(1)} — {result.q975.toFixed(1)} kW
              </div>
            </div>

            <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.22)" }}>
              <div className="text-xs" style={{ color: COLORS.muted }}>
                Relative Uncertainty (ρ)
              </div>
              <div className="mt-1 font-mono text-lg" style={{ color: COLORS.text }}>
                {result.rho.toFixed(2)}
              </div>
              <div className="mt-1 text-xs" style={{ color: COLORS.muted }}>
                VMD K={result.vmd_best_k}
              </div>
            </div>

            <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.22)" }}>
              <div className="text-xs" style={{ color: COLORS.muted }}>
                EV Charging Signal
              </div>
              <div
                className="mt-1 font-mono text-lg font-bold"
                style={{
                  color:
                    result.ev_signal === 1.0
                      ? COLORS.mint
                      : result.ev_signal === 0.5
                        ? COLORS.yellow
                        : COLORS.muted,
                }}
              >
                {evSignalLabel}
              </div>
            </div>
          </div>

          {/* Explanation */}
          {result.explanation && (
            <div className="mt-4 rounded p-3" style={{ background: "rgba(0,0,0,.3)" }}>
              <div className="text-xs" style={{ color: COLORS.muted }}>
                AI-Generated Explanation
              </div>
              <div className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.text }}>
                {result.explanation}
              </div>
            </div>
          )}
        </GlassPanel>
      )}
    </section>
  );
}
