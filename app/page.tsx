import Link from "next/link";
import { AvaPageShell, SectionHeader, StatusPill } from "@/app/components/ava-shell";
import { AutomationsStatusCenter } from "@/app/components/automations-status-center";
import { dailyBrief } from "@/lib/mock-data/ava";
import { getAvaSchedule, getAvaTasks } from "@/lib/ava/todoist";
import { getAvaWeather } from "@/lib/ava/weather";
import { getAvaProjects } from "@/lib/ava/projects";
import { getAvaIntelligenceFeed } from "@/lib/ava/intelligence";
import { getAvaDailyBrief } from "@/lib/ava/daily-brief";
import { getAvaCompletedTasks } from "@/lib/ava/completed-tasks";

export default async function Home() {
  const [{ groups: groupedTasks, source: taskSource }, completedTasks, schedule, liveWeather, liveProjects, liveFeed, liveBrief] = await Promise.all([
    getAvaTasks(),
    getAvaCompletedTasks(),
    getAvaSchedule(),
    getAvaWeather(),
    Promise.resolve(getAvaProjects()),
    getAvaIntelligenceFeed(),
    getAvaDailyBrief(),
  ]);
  return (
    <AvaPageShell eyebrow="Ava Dashboard" title="Home" subtitle="What needs your attention right now.">
      <section className="grid home-grid">
        <div className="panel attention-panel">
          <SectionHeader title="Daily Snapshot" action={<StatusPill tone="warning">1 review</StatusPill>} />
          <p className="snapshot-copy">{liveBrief.summary || dailyBrief.summary}</p>
        </div>
        <div className="panel">
          <SectionHeader title="Weather" action={<span className="badge">{liveWeather.location}</span>} />
          <div className="weather-value">{liveWeather.temperature}°</div>
          <div className="row-title">{liveWeather.condition}</div>
          <div className="row-meta">High {liveWeather.high}° · Low {liveWeather.low}° · Rain {liveWeather.rainChance}%</div>
          <p className="subtle">{liveWeather.recommendation}</p>
        </div>
        <div className="panel">
          <SectionHeader title="Calendar Preview" />
          <div className="list">
            {schedule.todayItems.slice(0, 2).map((event) => <div className="row" key={event.id}><span className="dot" /><div><div className="row-title">{event.title}</div><div className="row-meta">{event.dueDate} · Priority {event.priority} · Todoist</div></div><span className="badge">{event.status.replace("_", " ")}</span></div>)}
            {!schedule.todayItems.length ? <div className="row"><span className="dot normal" /><div><div className="row-title">No scheduled Todoist items today</div><div className="row-meta">Unscheduled items stay in Tasks.</div></div><span className="badge">clear</span></div> : null}
            <div className="open-block">Open block: 12:15 PM - 1:45 PM</div>
          </div>
        </div>
        <div className="panel">
          <SectionHeader title="Tasks Preview" action={<StatusPill tone={taskSource === "live-todoist" ? "good" : "warning"}>{taskSource === "live-todoist" ? "Live" : "Mock"}</StatusPill>} />
          <div className="mini-stats">
            <span>Overdue<strong>{groupedTasks.overdue.length}</strong></span>
            <span>Today<strong>{groupedTasks.today.length}</strong></span>
            <span>Next 3 days<strong>{groupedTasks.nextThreeDays.length}</strong></span>
            <span>Done<strong>{completedTasks.completedCount}</strong></span>
          </div>
        </div>
      </section>

      <section className="panel home-section">
        <SectionHeader title="Automation Health Preview" action={<Link className="badge" href="/automations">Open Automations</Link>} />
        <AutomationsStatusCenter compact />
      </section>

      <section className="grid columns home-section">
        <div className="panel">
          <SectionHeader title="Project Pulse" action={<Link className="badge" href="/projects">All Projects</Link>} />
          <div className="project-strip">
            {liveProjects.slice(0, 7).map((project) => (
              <div className="project-mini" key={project.name}>
                <div className="row-title">{project.name}</div>
                <div className="row-meta">{project.status} · {project.phase}</div>
                <p>{project.nextAction}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <SectionHeader title="Intelligence Feed Preview" action={<Link className="badge" href="/intelligence-feed">Open Feed</Link>} />
          <div className="list">
            {liveFeed.slice(0, 5).map((item) => <div className="row" key={item.id}><span className={`dot ${item.severity}`} /><div><div className="row-title">{item.title}</div><div className="row-meta">{item.timestamp} · {item.category} · {item.summary}</div></div></div>)}
          </div>
        </div>
      </section>
    </AvaPageShell>
  );
}
