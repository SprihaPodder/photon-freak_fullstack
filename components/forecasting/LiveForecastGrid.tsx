"use client";

import { useEffect, useMemo, useState } from "react";
import { Sun, Send, Sparkles, RotateCcw } from "lucide-react";

import GlassPanel from "@/components/ui/GlassPanel";
import MetricTicker from "@/components/ui/MetricTicker";
import ForecastIntervalChart from "@/components/charts/ForecastIntervalChart";
import { COLORS } from "@/lib/constants";

// Point this at wherever your FastAPI backend is running.
const API_BASE = "http://127.0.0.1:8001";

const FIELD_DEFS = [
  { key: "GHI", label: "GHI", unit: "W/m²" },
  { key: "DNI", label: "DNI", unit: "W/m²" },
  { key: "DHI", label: "DHI", unit: "W/m²" },
  { key: "EBH", label: "EBH", unit: "W/m²" },
  { key: "AirTemperature", label: "Air temp", unit: "°C" },
  { key: "CloudOpacity", label: "Cloud opacity", unit: "%" },
] as const;

type FieldKey = (typeof FIELD_DEFS)[number]["key"];

interface Prediction {
  datetime: string;
  q025: number;
  q50: number;
  q975: number;
  vmd_best_k: number;
  rho: number;
  ev_signal: number;
  explanation: string;
}

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const inputStyle: React.CSSProperties = {
  background: COLORS.panelSolid,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

export default function LiveForecastGrid() {
  const [datetime, setDatetime] = useState(toLocalInputValue(new Date()));
  const [values, setValues] = useState<Record<FieldKey, string>>({
    GHI: "", DNI: "", DHI: "", EBH: "", AirTemperature: "", CloudOpacity: "",
  });
  const [history, setHistory] = useState<Prediction[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resetting, setResetting] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);

  async function discardRound() {
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/rounds/reset`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");
      setHistory([]);
      setDatetime(toLocalInputValue(new Date()));
      setStatus("idle");
      setErrorMsg("");
      setRoundNumber((r) => r + 1);
    } catch (err: any) {
      setErrorMsg(typeof err?.message === "string" ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  // On mount, ask the backend what the last stored reading was and suggest
  // that +1 hour as the starting timestamp. The user can still edit this
  // for their FIRST submission; after that, it locks and auto-advances.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/history?hours=1`);
        if (!res.ok) return;
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const lastTs = new Date(rows[rows.length - 1].Datetime);
          setDatetime(toLocalInputValue(new Date(lastTs.getTime() + 3600 * 1000)));
        }
      } catch {
        // silently keep the "now" default if the backend isn't reachable yet
      }
    })();
  }, []);

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        ...h,
        label: new Date(h.datetime).toLocaleString([], {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        }),
        range: [h.q025, h.q975] as [number, number],
      })),
    [history]
  );

  const latest = history[history.length - 1];
  const isFirstEntry = history.length === 0;

  function updateField(key: FieldKey, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const payload = {
        datetime: `${datetime}:00`,
        GHI: parseFloat(values.GHI),
        DNI: parseFloat(values.DNI),
        DHI: parseFloat(values.DHI),
        EBH: parseFloat(values.EBH),
        AirTemperature: parseFloat(values.AirTemperature),
        CloudOpacity: parseFloat(values.CloudOpacity),
        Production: 0,
      };
      const res = await fetch(`${API_BASE}/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      setHistory((h) => [...h, data]);
      setStatus("idle");
      setDatetime(toLocalInputValue(new Date(new Date(datetime).getTime() + 3600 * 1000)));
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(typeof err?.message === "string" ? err.message : "Something went wrong");
    }
  }

  return (
    <>
      <div id="live-forecast-tool" style={{ scrollMarginTop: 24 }}>
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-[12.5px]"
          style={{ background: COLORS.panelSolid, border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
        >
          <span>
            Round <b style={{ color: COLORS.text }}>{roundNumber}</b> — <b style={{ color: COLORS.text }}>{history.length}</b> reading{history.length === 1 ? "" : "s"} submitted.
            Discard anytime to start a fresh round from clean baseline data.
          </span>
          <button
            onClick={discardRound}
            disabled={resetting}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-opacity disabled:opacity-50"
            style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "#ff6b6b" }}
          >
            <RotateCcw size={13} />
            {resetting ? "Discarding…" : "Discard round"}
          </button>
        </div>

        {history.length > 0 && history.length < 4 && (
          <div
            className="mb-5 rounded-xl px-4 py-3 text-[12px]"
            style={{ background: "rgba(255,180,84,0.08)", border: "1px solid rgba(255,180,84,0.25)", color: COLORS.amber }}
          >
            Round just started — the model has not built up real recent history yet, so the first few
            predictions are less accurate than usual. This improves automatically as you submit more
            readings in sequence.
          </div>
        )}

        <div className="mb-5 grid gap-5 md:grid-cols-3">
        <GlassPanel accent={COLORS.amber} style={{ padding: 20 }}>
          <MetricTicker
            label="Lower bound (q0.025)"
            value={latest?.q025 ?? 0}
            decimals={1}
            accent={COLORS.muted}
            active={!!latest}
          />
        </GlassPanel>
        <GlassPanel accent={COLORS.amber} style={{ padding: 20 }}>
          <MetricTicker
            label="Forecast (q0.50)"
            value={latest?.q50 ?? 0}
            decimals={1}
            accent={COLORS.amber}
            active={!!latest}
          />
        </GlassPanel>
        <GlassPanel accent={COLORS.amber} style={{ padding: 20 }}>
          <MetricTicker
            label="Upper bound (q0.975)"
            value={latest?.q975 ?? 0}
            decimals={1}
            accent={COLORS.muted}
            active={!!latest}
          />
        </GlassPanel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <GlassPanel accent={COLORS.amber} style={{ padding: 24 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.amber }}>
            <Sun size={13} /> Live Reading Input
          </div>

          <form onSubmit={submit} className="mt-4 flex flex-col gap-3.5">
            <label className="flex flex-col gap-1 text-[12.5px]" style={{ color: COLORS.muted }}>
              Timestamp{" "}
              <span style={{ opacity: 0.6 }}>
                {isFirstEntry ? "(set your starting time — auto-advances after this)" : "(auto-set, next hour)"}
              </span>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                readOnly={!isFirstEntry}
                required
                className="rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none"
                style={{ ...inputStyle, opacity: isFirstEntry ? 1 : 0.8 }}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              {FIELD_DEFS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-[12.5px]" style={{ color: COLORS.muted }}>
                  {f.label} <span style={{ opacity: 0.6 }}>({f.unit})</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={values[f.key]}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    className="rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none"
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13.5px] font-medium transition-opacity disabled:opacity-50"
              style={{ background: COLORS.amber, color: COLORS.void }}
            >
              <Send size={14} />
              {status === "loading" ? "Predicting…" : "Get forecast"}
            </button>

            {status === "error" && (
              <div
                className="rounded-lg px-3 py-2 text-[12px]"
                style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.3)", color: "#ff6b6b" }}
              >
                <div>{errorMsg}</div>
                {(errorMsg.includes("Gap too large") || errorMsg.includes("not after the last stored reading")) && (
                  <button
                    type="button"
                    onClick={discardRound}
                    disabled={resetting}
                    className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-opacity disabled:opacity-50"
                    style={{ background: "rgba(255,107,107,0.15)", border: "1px solid rgba(255,107,107,0.4)", color: "#ff6b6b" }}
                  >
                    <RotateCcw size={12} />
                    {resetting ? "Fixing…" : "Fix it — start a fresh round"}
                  </button>
                )}
              </div>
            )}
          </form>
        </GlassPanel>

        <GlassPanel accent={COLORS.amber} style={{ padding: 24, height: 420 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.amber }}>
            <Sun size={13} /> Prediction Interval — Session History
          </div>
          <div style={{ height: "84%" }}>
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[12.5px]" style={{ color: COLORS.muted }}>
                Submit a reading to start plotting the forecast interval.
              </div>
            ) : (
              <ForecastIntervalChart data={chartData} />
            )}
          </div>
          {latest && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px]" style={{ color: COLORS.muted }}>
              <span>VMD adaptive-K: {latest.vmd_best_k} modes</span>
              <span>ρ (uncertainty ratio): {latest.rho.toFixed(2)}</span>
              <span
                className="rounded-full px-2.5 py-0.5 font-medium"
                style={{
                  background:
                    latest.ev_signal === 1
                      ? "rgba(92,242,192,0.14)"
                      : latest.ev_signal === 0.5
                      ? "rgba(255,180,84,0.14)"
                      : "rgba(255,107,107,0.12)",
                  color:
                    latest.ev_signal === 1
                      ? COLORS.mint
                      : latest.ev_signal === 0.5
                      ? COLORS.amber
                      : "#ff6b6b",
                }}
              >
                EV charging: {latest.ev_signal === 1 ? "Full solar" : latest.ev_signal === 0.5 ? "Partial solar" : "No solar"}
              </span>
            </div>
          )}
        </GlassPanel>
      </div>

      {latest && (
        <div className="mt-5">
          <GlassPanel accent={COLORS.mint} style={{ padding: 22 }}>
            <div className="glass-eyebrow" style={{ color: COLORS.mint }}>
              <Sparkles size={13} /> What this means
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: COLORS.text }}>
              {latest.explanation}
            </p>
          </GlassPanel>
        </div>
      )}
      </div>
    </>
  );
}
