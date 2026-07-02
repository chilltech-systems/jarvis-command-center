import { addCentralDays, formatCentralDateKey, getCentralGreeting, getCentralHour } from "@/lib/ava/time";
import type { AvaDailyBriefOutput, AvaExecutiveContext, AvaBriefVariant } from "@/lib/ava/core/types";

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function variantForHour(hour = getCentralHour()): AvaBriefVariant {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";

  return "evening";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function naturalList(items: string[]) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function taskAreaSignals(tasks: Array<Record<string, any>>) {
  const text = tasks.map((task) => `${task.title || ""} ${task.project || ""}`).join(" ");

  return [
    /\b(reply|schedule|meeting|director|leader|preference|request)\b/i.test(text) ? "schedule replies" : "",
    /\b(home|house|trash|plant|haircut|water|personal)\b/i.test(text) ? "personal/home items" : "",
    /\b(invoice|report|packet|update|pay|review|confirm)\b/i.test(text) ? "admin follow-through" : "",
  ].filter(Boolean);
}

function tomorrowTasks(tasks: Array<Record<string, any>>) {
  const tomorrow = addCentralDays(formatCentralDateKey(), 1);

  return tasks.filter((task) => typeof task.scheduledFor === "string" && task.scheduledFor.slice(0, 10) === tomorrow);
}

export function buildExecutiveDailyBrief(context: Pick<AvaExecutiveContext, "raw" | "recentChanges" | "missionStatus" | "recommendedActions">): AvaDailyBriefOutput {
  const awareness = context.raw.cognitiveState.awareness;
  const tasks = asRecord(awareness.tasks);
  const taskGroups = asRecord(tasks.groups);
  const weather = asRecord(awareness.weather);
  const projects = asRecord(awareness.projects);
  const completedTasks = asRecord(awareness.completedTasks);
  const gmail = asRecord(awareness.gmail);
  const connections = Array.isArray(awareness.connections) ? awareness.connections : [];
  const variant = variantForHour();
  const todaysTasks = [...(Array.isArray(taskGroups.overdue) ? taskGroups.overdue : []), ...(Array.isArray(taskGroups.today) ? taskGroups.today : [])];
  const areas = taskAreaSignals(todaysTasks);
  const overdueCount = Array.isArray(taskGroups.overdue) ? taskGroups.overdue.length : 0;
  const highPriorityCount = Array.isArray(taskGroups.highPriority) ? taskGroups.highPriority.length : 0;
  const pressure = overdueCount
    ? `${plural(overdueCount, "overdue item")} should stay at the top`
    : highPriorityCount
      ? `${plural(highPriorityCount, "high-priority item")} should stay close`
      : "today's scheduled work is the main lane";
  const areaNote = areas.length ? `, especially ${naturalList(areas.slice(0, 3))}` : "";
  const eveningTasks = tomorrowTasks(Array.isArray(taskGroups.upcoming) ? taskGroups.upcoming : []);
  const eveningNote = variant === "evening"
    ? eveningTasks.length
      ? ` Since it is evening, I am also watching tomorrow's first handoff.`
      : " Since it is evening, I checked the next handoff and do not see anything that needs to interrupt tonight."
    : "";
  const completedCount = Number(completedTasks.completedCount || 0);
  const attentionCount = Number(gmail.attentionCount || 0);
  const urgentCount = Number(gmail.urgentCount || 0);
  const weatherNeedsAttention = Number(weather.rainChance || 0) >= 30 || Number(weather.high || 0) >= 95;
  const changeSentence = context.recentChanges.length
    ? ` I noticed ${plural(context.recentChanges.length, "meaningful change")} since the last snapshot.`
    : "";

  return {
    source: awareness.sources,
    variant,
    summary: [
      `${getCentralGreeting()}, Cody - I would keep your attention on today first: ${pressure}${areaNote}.`,
      `In the background, I see ${completedCount ? `${plural(completedCount, "task")} already cleared` : "no completed Todoist work showing yet"}, ${urgentCount ? `${plural(urgentCount, "urgent Gmail item")} worth checking` : attentionCount ? "some Gmail review weight" : "Gmail quiet or unavailable"}, and ${weatherNeedsAttention ? "weather may affect timing" : "weather is not changing the plan"}.${changeSentence}`,
      eveningNote.trim(),
    ].filter(Boolean).join(" "),
    scheduleOverview: `I am using Todoist as the schedule source. I found ${Array.isArray(taskGroups.today) ? taskGroups.today.length : 0} scheduled item${Array.isArray(taskGroups.today) && taskGroups.today.length === 1 ? "" : "s"} due today and ${Array.isArray(taskGroups.upcoming) ? taskGroups.upcoming.length : 0} coming up after that.`,
    taskPriorities: `I am watching ${highPriorityCount} high-priority item${highPriorityCount === 1 ? "" : "s"}. ${overdueCount} item${overdueCount === 1 ? " is" : "s are"} overdue. ${String(completedTasks.completedSummary || "I have not seen completed Todoist tasks yet today.")}`,
    weatherImpact: `I am tracking ${String(weather.condition || "current conditions").toLowerCase()} today: high ${Number(weather.high || 0)}°, low ${Number(weather.low || 0)}°, rain chance ${Number(weather.rainChance || 0)}%. ${String(weather.recommendation || "I do not see a major weather adjustment needed.")}`,
    businessPulse: `I found ${Number(projects.count || 0)} local project records. ${Number(projects.active || 0)} are active, ready, or prototyped, so I am keeping those closest to the surface.`,
    automationIssues: context.raw.cognitiveState.reasoning.openRisks.find((risk) => risk.entityType === "Automation")?.title || "I do not see unresolved automation issues in the executive context.",
    suggestedFocus: context.recommendedActions[0]?.action || context.raw.cognitiveState.reasoning.suggestedFocus,
    personalNotes: `I have Todoist, weather, Gmail attention, local projects, n8n automation status, and ${connections.filter((connection) => asRecord(connection).status === "Connected").length} connected system${connections.length === 1 ? "" : "s"} running through Executive Context.`,
  };
}
