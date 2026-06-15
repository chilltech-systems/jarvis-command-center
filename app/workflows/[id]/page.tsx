import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCentralSignal, formatCentralTime } from "@/lib/time";

export default async function WorkflowDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: workflow }, { data: executions }, { data: events }] = await Promise.all([
    supabase.from("jarvis_workflow_health").select("*").eq("workflow_id", id).single(),
    supabase.from("jarvis_executions").select("*").eq("workflow_id", id).order("collected_at", { ascending: false }).limit(30),
    supabase.from("jarvis_events").select("*").eq("workflow_id", id).order("occurred_at", { ascending: false }).limit(30),
  ]);
  return <main className="shell"><Link href="/" className="eyebrow">← Command Center</Link><section className="hero"><div><h1>{workflow?.name ?? "Workflow"}</h1><div className="subtle">{workflow?.business_area} · {workflow?.monitoring_mode} · {workflow?.current_health}</div></div><div className="badge">Central Time · CST/CDT</div></section><section className="grid columns"><div className="panel"><div className="panel-title">Execution History</div><div className="list">{executions?.map((e) => <div className="row" key={e.execution_id}><span className={`dot ${e.status}`} /><div><div className="row-title">{e.status} · {e.mode}</div><div className="row-meta">{e.started_at ? formatCentralSignal(e.started_at) : "Trigger error without start time"} · {e.duration_ms ?? 0} ms</div></div>{e.execution_url ? <a className="badge" href={e.execution_url} target="_blank">OPEN</a> : <span />}</div>)}</div></div><div className="panel"><div className="panel-title">Business Events</div><div className="list">{events?.length ? events.map((e) => <div className="row" key={e.event_id}><span className={`dot ${e.severity}`} /><div><div className="row-title">{e.event_type}</div><div className="row-meta">{e.summary} · {formatCentralTime(e.occurred_at)}</div></div><span className="badge">{e.status}</span></div>) : <p className="subtle">No detailed pulses received yet.</p>}</div></div></section></main>;
}
