import { AvaPageShell, SectionHeader, StatusPill } from "@/app/components/ava-shell";
import { getAvaCompletedTasks, type AvaCompletedTask } from "@/lib/ava/completed-tasks";
import { getAvaTasks, type AvaTask } from "@/lib/ava/todoist";

function TaskList({ title, tasks }: { title: string; tasks: AvaTask[] }) {
  return (
    <section className="panel">
      <SectionHeader title={title} action={<StatusPill>{tasks.length}</StatusPill>} />
      <div className="list">
        {tasks.map((task) => <div className="row" key={task.id}><span className={`dot ${task.priority <= 2 ? "high" : "normal"}`} /><div><div className="row-title">{task.title}</div><div className="row-meta">{task.project} · {task.dueDate} · Priority {task.priority} · {task.source}</div></div><span className="badge">{task.status.replace("_", " ")}</span></div>)}
      </div>
    </section>
  );
}

function CompletedTaskList({ tasks }: { tasks: AvaCompletedTask[] }) {
  return (
    <section className="panel span-full">
      <SectionHeader title="Completed Today" action={<StatusPill tone="good">{tasks.length}</StatusPill>} />
      <div className="list">
        {tasks.length ? tasks.map((task) => <div className="row" key={task.id}><span className="dot normal" /><div><div className="row-title">{task.title}</div><div className="row-meta">{task.project || "Todoist"} · Completed {new Date(task.completedAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })} · {task.source}</div></div><span className="badge">done</span></div>) : <div className="row"><span className="dot normal" /><div><div className="row-title">I have not seen completed Todoist tasks yet today</div><div className="row-meta">I will keep completed work here for debriefing.</div></div><span className="badge">clear</span></div>}
      </div>
    </section>
  );
}

export default async function TasksPage() {
  const [{ groups, source, error }, completedTasks] = await Promise.all([
    getAvaTasks(),
    getAvaCompletedTasks(),
  ]);
  const scheduledHighPriority = groups.highPriority.filter((task) => task.hasSchedule);

  return (
    <AvaPageShell eyebrow="Ava Tasks" title="Tasks" subtitle="I am sorting Todoist into what is late, due, next, and already handled.">
      <section className="panel source-panel">
        <SectionHeader title="Todoist Connection" action={<StatusPill tone={source === "live-todoist" ? "good" : "warning"}>{source === "live-todoist" ? "Live" : "Mock fallback"}</StatusPill>} />
        <p className="subtle">{source === "live-todoist" ? "I am showing scheduled Todoist items here. I keep unscheduled items out of the way but available for context." : `I am showing mock tasks because I could not read Todoist yet: ${error}`}</p>
      </section>
      <section className="grid brief-grid">
        <TaskList title="Overdue" tasks={groups.overdue} />
        <TaskList title="Today" tasks={groups.today} />
        <CompletedTaskList tasks={completedTasks.completedToday} />
        <TaskList title="Upcoming" tasks={groups.upcoming} />
        <TaskList title="High Priority" tasks={scheduledHighPriority} />
      </section>
    </AvaPageShell>
  );
}
