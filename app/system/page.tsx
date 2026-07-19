"use client";

import { ChevronRight, Activity, AlertTriangle, TrendingUp } from "lucide-react";

import SectionHeader from "@/components/ui/SectionHeader";
import GlassPanel from "@/components/ui/GlassPanel";
import { COLORS } from "@/lib/constants";

interface LayerProps {
  title: string;
  items: string[];
  accent: string;
}

function SystemLayer({ title, items, accent }: LayerProps) {
  return (
    <GlassPanel accent={accent} style={{ padding: 22, flex: 1, minWidth: 240 }}>
      <div className="glass-eyebrow" style={{ color: accent }}>{title}</div>
      <div className="mt-2.5 flex flex-col gap-2">
        {items.map((it) => (
          <div key={it} className="flex items-center gap-2 text-[12.5px]" style={{ color: COLORS.text }}>
            <ChevronRight size={13} color={accent} /> {it}
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

export default function SystemPage() {
  return (
    <>
      <SectionHeader
        title="Integrated System & IoT Deployment"
        subtitle="Edge inference for low-latency response, cloud-scale forecasting & optimization, and a unified operator dashboard."
      />

      <div className="mb-5 flex flex-wrap gap-5">
        <SystemLayer
          accent={COLORS.amber}
          title="Edge Layer"
          items={["Real-time monitoring", "Charging control", "SolarGuard-Net fault inference"]}
        />
        <SystemLayer
          accent={COLORS.cyan}
          title="Cloud Layer"
          items={[
            "Solar forecasting (CNN-LSTM-Tf / AK-VMD)",
            "Battery analytics (DVG-BiLSTM)",
            "PSO-GA charging optimization",
          ]}
        />
        <SystemLayer
          accent={COLORS.mint}
          title="User Interface Layer"
          items={["Generation trends", "Charging schedules", "Battery health & fault alerts"]}
        />
      </div>

      <GlassPanel accent={COLORS.violet} style={{ padding: 26, marginBottom: 20 }}>
        <div className="glass-eyebrow" style={{ color: COLORS.violet }}>
          <Activity size={13} /> Integrated Trace — What The System Does Together
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: COLORS.text }}>
          Solar generation with forecast uncertainty drives the charging envelope; the battery&apos;s live SoH derates
          the charging power ceiling in real time; and a fault signal from SolarGuard-Net can override charging
          entirely to trigger maintenance. Forecast confidence, battery health, and panel status jointly — not
          independently — determine every charging decision issued to the vehicle.
        </p>
      </GlassPanel>

      <div className="grid gap-5 md:grid-cols-2">
        <GlassPanel accent={COLORS.amber} style={{ padding: 22 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.amber }}>
            <AlertTriangle size={13} /> Limitations
          </div>
          <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-[12.5px]" style={{ color: COLORS.muted }}>
            <li>Panel fault dataset is relatively small (746 images)</li>
            <li>Quantile calibration is site-specific (PICP 80.7% → 83.6% on a second site)</li>
            <li>Degradation proxy is not yet a physics-informed electrochemical model</li>
          </ul>
        </GlassPanel>
        <GlassPanel accent={COLORS.cyan} style={{ padding: 22 }}>
          <div className="glass-eyebrow" style={{ color: COLORS.cyan }}>
            <TrendingUp size={13} /> Future Work
          </div>
          <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-[12.5px]" style={{ color: COLORS.muted }}>
            <li>Edge deployment on Jetson Nano-class hardware</li>
            <li>Vehicle-to-grid (V2G) extension</li>
            <li>Multi-step probabilistic forecasting (6h / 12h / 24h) + satellite cloud imagery</li>
          </ul>
        </GlassPanel>
      </div>
    </>
  );
}
