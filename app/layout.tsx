import type { Metadata } from "next";
import Link from "next/link";
import { Activity, RadioTower } from "lucide-react";
import { AccountControls } from "@/app/components/account-controls";
import { JarvisAssistant } from "@/app/components/jarvis-assistant";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jarvis Command Center",
  description: "CHILL TECH automation operations HUD",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="scanlines" />
        <header className="topbar">
          <Link href="/" className="brand">
            <RadioTower size={20} />
            <span>JARVIS</span>
            <small>COMMAND CENTER</small>
          </Link>
          <div className="topbar-actions">
            <div className="live-indicator"><Activity size={14} /> LIVE TELEMETRY</div>
            <AccountControls compact />
          </div>
        </header>
        {children}
        <JarvisAssistant />
      </body>
    </html>
  );
}
