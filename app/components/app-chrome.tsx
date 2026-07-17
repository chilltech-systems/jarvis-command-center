"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Sparkles } from "lucide-react";
import { AccountControls } from "@/app/components/account-controls";
import { AvaAssistant } from "@/app/components/ava-assistant";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = pathname === "/";

  if (immersive) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="scanlines" />
      <header className="topbar">
        <Link href="/dashboard" className="brand">
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
    </>
  );
}
