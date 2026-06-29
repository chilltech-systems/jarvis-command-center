import Link from "next/link";
import { CalendarDays, CheckSquare, Cpu, Home, Newspaper, Orbit, Settings, Sparkles, Workflow } from "lucide-react";
import { AvaClock } from "@/app/components/ava-clock";

export const avaTabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/daily-brief", label: "Daily Brief", icon: Sparkles },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: Orbit },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/intelligence-feed", label: "Intelligence Feed", icon: Newspaper },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AvaPageShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="shell">
      <section className="hero ava-hero">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <div className="subtle">{subtitle}</div>
        </div>
        <AvaClock />
      </section>
      <nav className="main-tabs" aria-label="Ava dashboard sections">
        {avaTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link href={tab.href} className="main-tab" key={tab.href}>
              <Icon size={15} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      {children}
    </main>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="panel-title">
      <span>{title}</span>
      {action}
    </div>
  );
}

export function StatusPill({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "good" | "warning" | "danger" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}
