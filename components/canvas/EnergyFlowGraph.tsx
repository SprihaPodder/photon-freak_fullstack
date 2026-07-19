"use client";

import { useEffect, useState } from "react";
import { Sun, BatteryMedium, ScanEye, Cpu, LucideIcon, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { COLORS } from "@/lib/constants";

interface FlowNode {
  id: string;
  x: number;
  y: number;
  label: string;
  sub: string;
  icon: LucideIcon;
  accent: string;
}

// Node box geometry — kept as constants so the truncation math below
// is derived from the real box size instead of a guessed character count.
const NODE_W = 190;
const NODE_H = 44;
const TEXT_X = 44; // left offset of text within the node
const RIGHT_PAD = 10; // breathing room before the node's right edge
const SUB_FONT_SIZE = 8; // px, JetBrains Mono
// JetBrains Mono is monospace at ~0.6em per character advance.
const SUB_CHAR_W = SUB_FONT_SIZE * 0.62;
const MAX_SUB_CHARS = Math.floor((NODE_W - TEXT_X - RIGHT_PAD) / SUB_CHAR_W);

function truncateSub(sub: string) {
  return sub.length > MAX_SUB_CHARS ? sub.slice(0, MAX_SUB_CHARS - 1) + "…" : sub;
}

const NODES: FlowNode[] = [
  { id: "solar", x: 60, y: 70, label: "Solar Forecast", sub: "AK-VMD (K=6) + QLightGBM", icon: Sun, accent: COLORS.cyan },
  { id: "battery", x: 60, y: 220, label: "Battery Health", sub: "DVG-BiLSTM · SoH/RUL/RUE", icon: BatteryMedium, accent: COLORS.violet },
  { id: "fault", x: 60, y: 370, label: "Fault Detection", sub: "SolarGuard-Net · EffNetV2-S", icon: ScanEye, accent: COLORS.amber },
  { id: "opt", x: 480, y: 220, label: "PSO-GA Optimizer", sub: "Battery-aware · Solar-coincident", icon: Cpu, accent: COLORS.mint },
];

const VIEW_W = 690;
const VIEW_H = 440;

/**
 * Signature visual for the Overview page — mirrors the paper's own
 * Fig. 1 system architecture: forecasting, battery health, and fault
 * detection all converge into the charging optimizer.
 */
export default function EnergyFlowGraph() {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let raf: number;
    const loop = (t: number) => {
      setTick(t / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const optimizer = NODES[3];
  const paths = NODES.slice(0, 3).map((n) => ({ from: n, to: optimizer }));

  const renderDiagram = () => (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="100%" style={{ overflow: "hidden" }}>
      <defs>
        <filter id="axis-glow">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {NODES.map((n) => (
          <clipPath id={`node-clip-${n.id}`} key={n.id}>
            <rect width={NODE_W} height={NODE_H} rx="12" />
          </clipPath>
        ))}
      </defs>

      {paths.map((p, i) => {
        const midX = (p.from.x + p.to.x) / 2 + 40;
        const d = `M ${p.from.x + 90} ${p.from.y + 22} C ${midX} ${p.from.y + 22}, ${midX} ${p.to.y + 22}, ${p.to.x} ${p.to.y + 22}`;
        return (
          <g key={i}>
            <path d={d} stroke={p.from.accent} strokeOpacity={0.22} strokeWidth={1.5} fill="none" />
            <circle r="3.2" fill={p.from.accent} filter="url(#axis-glow)">
              <animateMotion dur="3.4s" repeatCount="indefinite" path={d} begin={`${i * -1.1}s`} />
            </circle>
          </g>
        );
      })}

      {NODES.map((n) => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`}>
          <rect width={NODE_W} height={NODE_H} rx="12" fill="rgba(11,17,28,0.85)" stroke={n.accent} strokeOpacity="0.5" />
          <rect
            width={NODE_W}
            height={NODE_H}
            rx="12"
            fill={n.accent}
            opacity={0.06 + 0.03 * Math.sin(tick * 2 + n.x)}
          />
          <circle cx="24" cy="22" r="12" fill={n.accent} opacity="0.16" />
          <foreignObject x="4" y="2" width="40" height="40">
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <n.icon size={16} color={n.accent} />
            </div>
          </foreignObject>
          {/* Clip group: guarantees label text can never render outside the node box,
              regardless of string length or font metrics. */}
          <g clipPath={`url(#node-clip-${n.id})`}>
            <text x={TEXT_X} y="18" fill={COLORS.text} fontSize="11.5" fontFamily="var(--font-space-grotesk)" fontWeight="600">
              {n.label}
            </text>
            <text x={TEXT_X} y="32" fill={COLORS.muted} fontSize={SUB_FONT_SIZE} fontFamily="var(--font-jetbrains-mono)">
              {truncateSub(n.sub)}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );

  return (
    <div className="relative h-full w-full">
      <button
        type="button"
        onClick={() => {
          setZoom(1);
          setOpen(true);
        }}
        aria-label="Expand diagram"
        className="absolute right-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-[8px] border transition-colors hover:bg-white/5"
        style={{ borderColor: COLORS.border, background: "rgba(11,17,28,0.7)" }}
      >
        <Maximize2 size={13} color={COLORS.muted} />
      </button>

      {renderDiagram()}

      {open && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex h-full max-h-[820px] w-full max-w-[1100px] flex-col rounded-[20px] border"
            style={{ background: COLORS.panel, borderColor: COLORS.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
                Live Signal Path
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                  aria-label="Zoom out"
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border hover:bg-white/5"
                  style={{ borderColor: COLORS.border }}
                >
                  <ZoomOut size={15} color={COLORS.muted} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
                  aria-label="Zoom in"
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border hover:bg-white/5"
                  style={{ borderColor: COLORS.border }}
                >
                  <ZoomIn size={15} color={COLORS.muted} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border hover:bg-white/5"
                  style={{ borderColor: COLORS.border }}
                >
                  <X size={15} color={COLORS.muted} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 overflow-auto rounded-b-[20px] px-5 pb-5">
              <div
                style={{
                  width: `${VIEW_W * zoom}px`,
                  height: `${VIEW_H * zoom}px`,
                  transition: "width 0.2s ease, height 0.2s ease",
                }}
              >
                {renderDiagram()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
