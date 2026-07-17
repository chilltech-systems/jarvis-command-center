import { Activity, Brain, Clock, Database, HeartPulse, RadioTower, Rows3, Workflow } from "lucide-react";
import { AvaPageShell, SectionHeader, StatusPill } from "@/app/components/ava-shell";
import { getAvaRuntime } from "@/lib/ava/runtime";

function formatAge(ageMs: number | null) {
  if (ageMs === null) return "No snapshot";
  if (ageMs < 1_000) return `${ageMs} ms`;
  const seconds = Math.round(ageMs / 1_000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

function entityCounts(runtime: ReturnType<typeof getAvaRuntime>) {
  return runtime.entities.listEntities().reduce<Record<string, number>>((counts, entity) => {
    counts[entity.type] = (counts[entity.type] || 0) + 1;
    return counts;
  }, {});
}

export default async function RuntimeDiagnosticsPage() {
  const runtime = getAvaRuntime();
  if (runtime.getStatus().lifecycleStage === "shutdown") {
    await runtime.start();
  }

  const status = runtime.getStatus();
  const state = runtime.store.getState();
  const runtimeContext = runtime.context.getContext();
  const health = status.health;
  const counts = entityCounts(runtime);
  const recentEvents = runtime.eventBus.getRecentEvents(8);
  const jobs = status.scheduler.jobs;
  const perceptionAdapters = runtime.perception.getDiagnostics();
  const perceptionStats = runtime.perception.getObservationStats();
  const perceptionEvents = runtime.eventBus.getRecentEvents(100).filter((event) => event.type.startsWith("perception."));

  return (
    <AvaPageShell eyebrow="Ava Runtime" title="Runtime Diagnostics" subtitle="Internal view of Ava's continuous cognition loop.">
      <section className="grid metrics runtime-metrics">
        <article className="metric">
          <div className="metric-label"><HeartPulse size={13} /> Status</div>
          <div className="metric-value">{status.lifecycleStage}</div>
        </article>
        <article className="metric">
          <div className="metric-label"><Clock size={13} /> Snapshot Age</div>
          <div className="metric-value">{formatAge(runtime.snapshots.getSnapshotAgeMs())}</div>
        </article>
        <article className="metric">
          <div className="metric-label"><Workflow size={13} /> Scheduler</div>
          <div className="metric-value">{status.scheduler.status}</div>
        </article>
        <article className="metric">
          <div className="metric-label"><RadioTower size={13} /> Events</div>
          <div className="metric-value">{recentEvents.length}</div>
        </article>
        <article className="metric">
          <div className="metric-label"><Database size={13} /> Memory</div>
          <div className="metric-value">{health.memoryStatus.replace("_", " ")}</div>
        </article>
        <article className="metric">
          <div className="metric-label"><Brain size={13} /> Health</div>
          <div className="metric-value">{health.status}</div>
        </article>
      </section>

      <section className="grid columns home-section">
        <div className="panel">
          <SectionHeader title="Perception Adapters" action={<StatusPill>{perceptionAdapters.length} registered</StatusPill>} />
          <div className="timeline">
            {perceptionAdapters.map((adapter) => (
              <article className="timeline-item" key={adapter.id}>
                <span className={`dot ${adapter.connected ? "normal" : adapter.enabled ? "warning" : "unknown"}`} />
                <div>
                  <div className="timeline-meta">{adapter.sourceType} · {adapter.state} · {adapter.health.status}</div>
                  <h2>{adapter.label}</h2>
                  <p>
                    {adapter.health.message || "Adapter has no health message."} Last observation: {adapter.lastObservationAt || "none"}.
                    {" "}Entities: {String(adapter.health.details?.entityCount ?? 0)} · Devices: {String(adapter.health.details?.deviceCount ?? 0)} · Areas: {String(adapter.health.details?.areaCount ?? 0)} · Reconnects: {String(adapter.health.details?.reconnectCount ?? 0)}
                  </p>
                </div>
                <span className="badge">{adapter.observationCount} obs</span>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Perception Throughput" action={<StatusPill>{perceptionEvents.length} events</StatusPill>} />
          <div className="detail-grid runtime-detail-grid">
            <span>Total Observations<strong>{perceptionStats.total}</strong></span>
            <span>Last Observation<strong>{perceptionStats.lastObservationAt || "None"}</strong></span>
            <span>Connected<strong>{perceptionAdapters.filter((adapter) => adapter.connected).length}</strong></span>
            <span>Disabled<strong>{perceptionAdapters.filter((adapter) => !adapter.enabled || adapter.state === "disabled").length}</strong></span>
          </div>
          <div className="list">
            {Object.entries(perceptionStats.byAdapter).map(([adapter, count]) => (
              <div className="row" key={adapter}><span className="dot normal" /><div><div className="row-title">{adapter}</div><div className="row-meta">{count} normalized observation{count === 1 ? "" : "s"}</div></div></div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid columns home-section">
        <div className="panel">
          <SectionHeader title="Current Cognition" action={<StatusPill tone={state.latestSnapshot ? "good" : "warning"}>{state.latestSnapshot ? "Ready" : "Pending"}</StatusPill>} />
          <div className="detail-grid runtime-detail-grid">
            <span>Mission Status<strong>{state.latestExecutiveContext?.missionStatus || "Unknown"}</strong></span>
            <span>Current Focus<strong>{runtimeContext.currentFocus || "No active focus"}</strong></span>
            <span>Timeline Events<strong>{state.latestTimeline.length}</strong></span>
            <span>Visible Changes<strong>{state.latestVisibleChanges.length}</strong></span>
            <span>Recommendations<strong>{state.latestRecommendations.length}</strong></span>
            <span>Heartbeat<strong>{status.heartbeatCount}</strong></span>
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Context Summary" action={<StatusPill>{runtimeContext.runtimeStatus}</StatusPill>} />
          <div className="list">
            <div className="row"><span className="dot normal" /><div><div className="row-title">Mission</div><div className="row-meta">{runtimeContext.currentMission || "No mission set"}</div></div></div>
            <div className="row"><span className="dot normal" /><div><div className="row-title">Active User</div><div className="row-meta">{runtimeContext.activeUser || "No active user set"}</div></div></div>
            <div className="row"><span className="dot normal" /><div><div className="row-title">Entities</div><div className="row-meta">{Object.entries(counts).map(([type, count]) => `${type}: ${count}`).join(" · ") || "No runtime entities registered"}</div></div></div>
          </div>
        </div>
      </section>

      <section className="grid columns home-section">
        <div className="panel">
          <SectionHeader title="Scheduler Jobs" action={<StatusPill>{jobs.length} jobs</StatusPill>} />
          <div className="timeline">
            {jobs.map((job) => (
              <article className="timeline-item" key={job.id}>
                <span className={`dot ${job.lastError ? "warning" : "normal"}`} />
                <div>
                  <div className="timeline-meta">{job.enabled ? "enabled" : "disabled"} · every {Math.round(job.intervalMs / 1000)}s</div>
                  <h2>{job.label}</h2>
                  <p>Last run: {job.lastRunAt || "not yet"} · Next: {job.nextRunAt || "not scheduled"} · Duration: {job.lastDurationMs ?? 0} ms</p>
                </div>
                <span className="badge">{job.id}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <SectionHeader title="Event Bus Activity" action={<StatusPill>{runtime.eventBus.getSubscriptionCount()} subs</StatusPill>} />
          <div className="list">
            {recentEvents.map((event) => (
              <div className="row" key={event.id}>
                <span className={`dot ${event.priority === "critical" || event.priority === "high" ? "warning" : "normal"}`} />
                <div>
                  <div className="row-title">{event.type}</div>
                  <div className="row-meta">{event.timestamp} · {event.origin} · {event.source}</div>
                </div>
                <span className="badge">{event.priority}</span>
              </div>
            ))}
            {!recentEvents.length ? <div className="row"><span className="dot warning" /><div><div className="row-title">No runtime events yet</div><div className="row-meta">Start the runtime to populate event history.</div></div></div> : null}
          </div>
        </div>
      </section>

      <section className="panel home-section">
        <SectionHeader title="Health Summary" action={<StatusPill tone={health.status === "healthy" ? "good" : health.status === "warning" ? "warning" : "danger"}>{health.status}</StatusPill>} />
        <div className="detail-grid">
          <span>Uptime<strong>{Math.round(health.uptimeMs / 1000)}s</strong></span>
          <span>Scheduler Latency<strong>{health.schedulerLatencyMs ?? 0} ms</strong></span>
          <span>Heartbeat Latency<strong>{health.heartbeatLatencyMs ?? 0} ms</strong></span>
          <span>Warnings<strong>{health.warnings.length}</strong></span>
        </div>
      </section>
    </AvaPageShell>
  );
}
