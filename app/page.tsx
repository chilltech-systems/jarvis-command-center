import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ago = (value?: string | null) => value ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000)), "minute") : "No signal";

export default async function Dashboard() {
  const supabase = await createClient();
  const [{ data: overviewRows }, { data: activity }, { data: issues }, { data: workflows }] = await Promise.all([
    supabase.from("jarvis_hud_overview").select("*").limit(1),
    supabase.from("jarvis_recent_activity").select("*").order("occurred_at", { ascending: false }).limit(12),
    supabase.from("jarvis_open_issues").select("*").order("occurred_at", { ascending: false }).limit(8),
    supabase.from("jarvis_workflow_health").select("*").order("name").limit(50),
  ]);
  const o = overviewRows?.[0] ?? {};
  const successRate = Number(o.executions_today) ? Math.round((Number(o.successes_today) / Number(o.executions_today)) * 100) : 100;

  return <main className="shell">
    <section className="hero"><div><div className="eyebrow">CHILL TECH Operational Intelligence</div><h1>Automation Command</h1><div className="subtle">Live n8n executions, business pulses, and operational issues.</div></div><div className="badge">America / Chicago</div></section>
    <section className="grid metrics">
      {[["Active", o.active_workflows], ["Healthy", o.healthy_workflows], ["Unknown", o.unknown_workflows], ["Executions", o.executions_today], ["Success Rate", `${successRate}%`], ["Open Issues", o.open_issues]].map(([label, value]) => <div className="metric" key={label}><div className="metric-label">{label}</div><div className="metric-value">{String(value ?? 0)}</div></div>)}
    </section>
    <section className="grid columns">
      <div className="panel"><div className="panel-title"><span>Live Activity Stream</span><span>{activity?.length ?? 0} SIGNALS</span></div><div className="list">{activity?.map((item) => <div className="row" key={`${item.activity_source}-${item.activity_id}`}><span className={`dot ${item.severity} ${item.status}`} /><div><div className="row-title">{item.source_name}</div><div className="row-meta">{item.summary} · {ago(item.occurred_at)}</div></div><span className="badge">{item.status}</span></div>)}</div></div>
      <div className="panel"><div className="panel-title"><span>Requires Attention</span><span>{issues?.length ?? 0} OPEN</span></div><div className="list">{issues?.length ? issues.map((item) => <div className="row" key={item.event_id}><span className={`dot ${item.severity}`} /><div><div className="row-title">{item.source_workflow}</div><div className="row-meta">{item.summary}</div></div><span className="badge">{item.urgency || item.severity}</span></div>) : <p className="subtle">No unresolved Jarvis events.</p>}</div></div>
    </section>
    <section className="grid workflow-grid">{workflows?.map((w) => <Link className="workflow-card" href={`/workflows/${w.workflow_id}`} key={w.workflow_id}><div className="workflow-name"><span>{w.name}</span><span className={`dot ${w.current_health}`} /></div><div className="row-meta">{w.business_area} · {w.monitoring_mode}</div><div className="workflow-stats"><span>Runs<strong>{w.executions_today}</strong></span><span>Errors<strong>{w.errors_today}</strong></span><span>Last signal<strong>{ago(w.last_pulse_at || w.last_execution_at)}</strong></span></div></Link>)}</section>
  </main>;
}
