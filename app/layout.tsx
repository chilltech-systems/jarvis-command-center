import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Sparkles } from "lucide-react";
import { AccountControls } from "@/app/components/account-controls";
import { AvaAssistant } from "@/app/components/ava-assistant";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ava",
  description: "Personal and business AI operating system dashboard",
  icons: {
    icon: "/ava-icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="scanlines" />
        <header className="topbar">
          <Link href="/" className="brand">
            <Sparkles size={20} />
            <span>Ava</span>
            <small>Dashboard</small>
          </Link>
          <div className="topbar-actions">
            <div className="live-indicator"><Activity size={14} /> System Pulse</div>
            <AccountControls compact />
          </div>
        </header>
        {children}
        <AvaAssistant />
      </body>
    </html>
  );
}
