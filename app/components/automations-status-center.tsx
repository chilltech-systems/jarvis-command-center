import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { automationSnapshot } from "@/lib/mock-data/ava";
import { formatCentralSignal, formatCentralTime } from "@/lib/time";

export async function AutomationsStatusCenter({ compact = false }: { compact?: boolean }) {
  const supabase = await createClient();
  const [{ data: overviewRows }, { data: activity }, { data: issues }, { data: workflows }] = await Promise.all([
    supabase.from("jarvis_hud_overview").select("*").limit(1),
    supabase.from("jarvis_recent_activity").select("*").order("occurred_at", { ascending: false }).limit(compact ? 4 : 12),
    supabase.from("jarvis_open_issues").select("*").order("occurred_at", { ascending: false }).limit(compact ? 3 : 8),
    supabase.from("jarvis_workflow_health").select("*").order("name").limit(compact ? 6 : 50),
  ]);
  const o = overviewRows?.[0] ?? {};
  const executionsToday = Number(o.executions_today ?? 0);
  const successRate = executionsToday ? Math.round((Number(o.successes_today) / executionsToday) * 100) : 100;
  const latestFailure = issues?.[0]?.summary ?? automationSnapshot.latestFailure;

  return (
    <div className="automation-status">
      <section className="grid metrics">
        {[
          ["Healthy", o.healthy_workflows],
          ["Warning", o.warning_workflows],
          ["Failed", o.critical_workflows],
          ["Needs Review", o.open_issues],
          ["Executions", o.executions_today],
          ["Success Rate", `${successRate}%`],
        ].map(([label, value]) => <div className="metric" key={label}><div className="metric-label">{label}</div><div className="metric-value">{String(value ?? 0)}</div></div>)}
      </section>
      <section className="grid columns">
        <div className="panel">
          <div className="panel-title"><span>Workflow List</span><span>{workflows?.length ?? 0} TRACKED</span></div>
          <div className="list">
            {workflows?.map((w) => (
              <Link className="row automation-row" href={`/workflows/${w.workflow_id}`} key={w.workflow_id}>
                <span className={`dot ${w.current_health}`} />
                <div>
                  <div className="row-title">{w.name}</div>
                  <div className="row-meta">{w.business_area} · Last execution {formatCentralSignal(w.last_execution_at || w.last_pulse_at)}</div>
                </div>
                <span className="badge">{w.current_health === "critical" ? "Failed" : w.current_health}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-title"><span>Recent Errors</span><span>{issues?.length ?? 0} OPEN</span></div>
          <div className="list">
            {issues?.length ? issues.map((item) => (
              <div className="row" key={item.event_id}>
                <span className={`dot ${item.severity}`} />
                <div>
                  <div className="row-title">{item.source_workflow}</div>
                  <div className="row-meta">{item.summary} · {formatCentralTime(item.occurred_at)}</div>
                </div>
                <span className="badge">{item.urgency || item.severity}</span>
              </div>
            )) : <p className="subtle">I do not see unresolved automation events right now.</p>}
          </div>
          <div className="ai-fix">
            <div className="eyebrow">What I would check</div>
            <p>{latestFailure}</p>
          </div>
        </div>
      </section>
      {!compact && (
        <section className="panel activity-panel">
          <div className="panel-title"><span>Live Activity Stream</span><span>{activity?.length ?? 0} SIGNALS</span></div>
          <div className="list">{activity?.map((item) => (
            <div className="row" key={`${item.activity_source}-${item.activity_id}`}>
              <span className={`dot ${item.severity} ${item.status}`} />
              <div>
                <div className="row-title">{item.source_name}</div>
                <div className="row-meta">{item.summary} · {formatCentralSignal(item.occurred_at)}</div>
              </div>
              <span className="badge">{item.status}</span>
            </div>
          ))}</div>
        </section>
      )}
    </div>
  );
}
