import { getAvaTasks } from "@/lib/ava/todoist";
import { getAvaWeather } from "@/lib/ava/weather";
import { getProjectSummary } from "@/lib/ava/projects";
import { automationSnapshot } from "@/lib/mock-data/ava";
import { formatCentralDateKey, getCentralGreeting, getCentralHour, addCentralDays } from "@/lib/ava/time";
import { getAvaCompletedTasks } from "@/lib/ava/completed-tasks";
import { getAvaGmailAttention } from "@/lib/ava/gmail-attention";
import { getConnectorSnapshots } from "@/lib/ava/connector-snapshot";

type AvaTaskLike = Awaited<ReturnType<typeof getAvaTasks>>["tasks"][number];

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function tomorrowTasks(tasks: AvaTaskLike[]) {
  const tomorrow = addCentralDays(formatCentralDateKey(), 1);

  return tasks.filter((task) => task.scheduledFor?.slice(0, 10) === tomorrow);
}

function countMatching(tasks: AvaTaskLike[], pattern: RegExp) {
  return tasks.filter((task) => pattern.test(`${task.title} ${task.project}`)).length;
}

function taskAreaSignals(tasks: AvaTaskLike[]) {
  const scheduleReplies = countMatching(tasks, /\b(reply|schedule|meeting|director|leader|preference|request)\b/i);
  const personalHome = countMatching(tasks, /\b(home|house|trash|plant|haircut|water|personal)\b/i);
  const adminMoney = countMatching(tasks, /\b(invoice|report|packet|update|pay|review|confirm)\b/i);

  return [
    scheduleReplies ? "schedule replies" : "",
    personalHome ? "personal/home items" : "",
    adminMoney ? "admin follow-through" : "",
  ].filter(Boolean);
}

function naturalList(items: string[]) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function todayTaskSignal(tasks: Awaited<ReturnType<typeof getAvaTasks>>) {
  const todaysTasks = [...tasks.groups.overdue, ...tasks.groups.today];
  if (!todaysTasks.length) return "Today looks clear in Todoist, so I am keeping the workspace quiet unless something new lands";

  const areas = taskAreaSignals(todaysTasks);
  const highPriorityCount = todaysTasks.filter((task) => task.priority <= 2).length;
  const pressure = tasks.groups.overdue.length
    ? `${plural(tasks.groups.overdue.length, "overdue item")} should stay at the top`
      : highPriorityCount
        ? `${plural(highPriorityCount, "high-priority item")} should stay close`
        : "today's scheduled work is the main lane";
  const areaNote = areas.length ? `, especially ${naturalList(areas.slice(0, 3))}` : "";

  return `I would keep your attention on today first: ${pressure}${areaNote}`;
}

function contextSignal({
  completedTasks,
  gmailAttention,
  weather,
}: {
  completedTasks: Awaited<ReturnType<typeof getAvaCompletedTasks>>;
  gmailAttention: Awaited<ReturnType<typeof getAvaGmailAttention>>;
  weather: Awaited<ReturnType<typeof getAvaWeather>>;
}) {
  const completionNote = completedTasks.completedCount > 0
    ? `${plural(completedTasks.completedCount, "task")} already cleared`
    : "no completed Todoist work showing yet";
  const emailNote = gmailAttention.urgentCount > 0
    ? `${plural(gmailAttention.urgentCount, "urgent Gmail item")} worth checking`
    : gmailAttention.attentionCount > 0
      ? "some Gmail review weight"
      : gmailAttention.source === "live-gmail"
        ? "Gmail quiet"
        : "Gmail not fully checked";
  const weatherNote = weather.rainChance >= 30 || weather.high >= 95
    ? "weather may affect timing"
    : "weather is not changing the plan";

  return `In the background, I see ${completionNote}, ${emailNote}, and ${weatherNote}.`;
}

function eveningSignal(tasks: Awaited<ReturnType<typeof getAvaTasks>>, afterSeven: boolean) {
  if (!afterSeven) return "";

  const tomorrow = tomorrowTasks(tasks.groups.upcoming);
  if (tomorrow.length) {
    const areas = taskAreaSignals(tomorrow);
    const areaNote = areas.length ? ` around ${naturalList(areas.slice(0, 2))}` : "";

    return `Since it is evening, I am also watching tomorrow's first handoff${areaNote}.`;
  }
  if (tasks.groups.upcoming.length) return "Since it is evening, I am keeping one eye on the next scheduled handoff after today.";

  return "Since it is evening, I checked the next handoff and do not see anything that needs to interrupt tonight.";
}

function buildSnapshotSummary({
  tasks,
  completedTasks,
  weather,
  gmailAttention,
}: {
  tasks: Awaited<ReturnType<typeof getAvaTasks>>;
  completedTasks: Awaited<ReturnType<typeof getAvaCompletedTasks>>;
  weather: Awaited<ReturnType<typeof getAvaWeather>>;
  gmailAttention: Awaited<ReturnType<typeof getAvaGmailAttention>>;
}) {
  const hour = getCentralHour();
  const afterSeven = hour >= 19;
  const eveningNote = eveningSignal(tasks, afterSeven);

  return [
    `${getCentralGreeting()}, Cody - ${todayTaskSignal(tasks)}.`,
    contextSignal({ completedTasks, gmailAttention, weather }),
    eveningNote,
  ].filter(Boolean).join(" ");
}

export async function getAvaDailyBrief() {
  const [tasks, completedTasks, weather, projects, gmailAttention] = await Promise.all([
    getAvaTasks(),
    getAvaCompletedTasks(),
    getAvaWeather(),
    Promise.resolve(getProjectSummary()),
    getAvaGmailAttention(),
  ]);
  const connectorCount = getConnectorSnapshots().filter((connector) => connector.status === "Connected").length;

  const completedClause = completedTasks.completedCount > 0 ? ` I also saw ${completedTasks.completedCount} Todoist task${completedTasks.completedCount === 1 ? "" : "s"} already completed today.` : "";
  const overdueLabel = `${tasks.groups.overdue.length} item${tasks.groups.overdue.length === 1 ? "" : "s"} ${tasks.groups.overdue.length === 1 ? "is" : "are"} overdue`;
  const summary = buildSnapshotSummary({ tasks, completedTasks, weather, gmailAttention });

  return {
    source: {
      tasks: tasks.source,
      completedTasks: completedTasks.source,
      weather: weather.source,
      projects: projects.source,
      gmail: gmailAttention.source,
      automations: "supabase-n8n",
    },
    summary,
    scheduleOverview: `I am using Todoist as the schedule source. I found ${tasks.groups.today.length} scheduled item${tasks.groups.today.length === 1 ? "" : "s"} due today and ${tasks.groups.upcoming.length} coming up after that.`,
    taskPriorities: `I am watching ${tasks.groups.highPriority.filter((task) => task.hasSchedule).length} scheduled high-priority item${tasks.groups.highPriority.filter((task) => task.hasSchedule).length === 1 ? "" : "s"}. ${overdueLabel}. ${completedTasks.completedSummary}`,
    weatherImpact: `I am tracking ${weather.condition.toLowerCase()} today: high ${weather.high}°, low ${weather.low}°, rain chance ${weather.rainChance}%. ${weather.recommendation}`,
    businessPulse: `I found ${projects.count} local project records. ${projects.active} are active, ready, or prototyped, so I am keeping those closest to the surface.`,
    automationIssues: `I am keeping an eye on this automation note: ${automationSnapshot.latestFailure}`,
    suggestedFocus: tasks.groups.overdue.length
      ? "I would clear the overdue Todoist queue first, then move into project work."
      : "I would use the first focused block for project work, then do an automation pass.",
    personalNotes: `I have Todoist, weather, Gmail attention, local projects, n8n automation status, and ${connectorCount} connected connector snapshot${connectorCount === 1 ? "" : "s"} running in the local preview.`,
  };
}
