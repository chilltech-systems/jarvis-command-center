import { AvaPageShell, SectionHeader, StatusPill } from "@/app/components/ava-shell";
import { calendarEvents, freeBlocks, upcomingEvents } from "@/lib/mock-data/ava";
import { getAvaSchedule } from "@/lib/ava/todoist";

export default async function CalendarPage() {
  const schedule = await getAvaSchedule();
  const liveToday = schedule.source === "live-todoist" ? schedule.todayItems : [];
  const liveUpcoming = schedule.source === "live-todoist" ? schedule.upcomingItems : [];

  return (
    <AvaPageShell eyebrow="Ava Calendar" title="Calendar" subtitle="Todoist-powered schedule, due work, and protected free blocks.">
      <section className="panel source-panel">
        <SectionHeader title="Todoist Calendar Source" action={<StatusPill tone={schedule.source === "live-todoist" ? "good" : "warning"}>{schedule.source === "live-todoist" ? "Live" : "Mock fallback"}</StatusPill>} />
        <p className="subtle">{schedule.source === "live-todoist" ? "Ava is using Todoist due dates and scheduled times as your calendar. Unscheduled Todoist items stay on the Tasks tab." : `Ava is showing mock calendar data because Todoist could not be read: ${schedule.error}`}</p>
      </section>
      <section className="grid columns">
        <div className="panel">
          <SectionHeader title="Today's Todoist Calendar" />
          <div className="appointment-list">
            {(liveToday.length ? liveToday : calendarEvents).map((event) => "dueDate" in event
              ? <article className="appointment-card" key={event.id}><div className="appointment-time">{event.dueDate}</div><div><div className="row-title">{event.title}</div><div className="row-meta">{event.project} · Priority {event.priority}</div></div><span className="badge">{event.status.replace("_", " ")}</span></article>
              : <article className="appointment-card" key={event.id}><div className="appointment-time">{event.time}</div><div><div className="row-title">{event.title}</div><div className="row-meta">{event.duration} · {event.location}</div></div><span className="badge">{event.type}</span></article>)}
          </div>
        </div>
        <div className="panel">
          <SectionHeader title="Free Blocks" />
          <div className="list">{freeBlocks.map((block) => <div className="row" key={block.id}><span className="dot" /><div><div className="row-title">{block.label}</div><div className="row-meta">{block.time}</div></div></div>)}</div>
        </div>
      </section>
      <section className="panel home-section">
        <SectionHeader title="Upcoming Scheduled Todoist Items" />
        <div className="project-strip">{(liveUpcoming.length ? liveUpcoming : upcomingEvents).map((event) => "title" in event && "dueDate" in event
          ? <div className="project-mini" key={event.id}><div className="row-title">{event.title}</div><div className="row-meta">{event.dueDate} · Priority {event.priority}</div><p>{event.project}</p></div>
          : <div className="project-mini" key={event.id}><div className="row-title">{event.title}</div><div className="row-meta">{event.date} · {event.time}</div><p>Ready for future Todoist schedule expansion.</p></div>)}</div>
      </section>
    </AvaPageShell>
  );
}
