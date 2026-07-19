import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import Dock from "@/components/ui/Dock";
import ParticleField from "@/components/canvas/ParticleField";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "AXIS — Solar-EV Intelligence Mission Control",
  description:
    "Unified command center for solar forecasting, battery health, EV charging optimization, and panel fault detection.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-void font-body text-ink antialiased">
        {/* Ambient aurora wash, sits above the void background, below content */}
        <div
          className="pointer-events-none fixed inset-0 -z-[5]"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 10%, rgba(139,124,255,0.14), transparent 60%), radial-gradient(ellipse 60% 50% at 10% 90%, rgba(79,216,255,0.10), transparent 60%)",
          }}
        />
        <ParticleField />
        <Dock />

        <main className="relative z-10 mx-auto max-w-[1180px] px-10 py-12 pl-[110px]">
          <div className="mb-10 flex items-center gap-2.5">
            <div
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]"
              style={{
                background: "linear-gradient(135deg, #4fd8ff, #8b7cff)",
                boxShadow: "0 0 24px rgba(79,216,255,0.35)",
              }}
            >
              <span className="text-sm font-bold text-void">Z</span>
            </div>
            <div className="font-display text-lg font-bold tracking-wide">AXIS</div>
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
