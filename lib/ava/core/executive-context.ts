import { buildExecutiveDailyBrief } from "@/lib/ava/core/briefing";
import { buildFocusPlan } from "@/lib/ava/core/focus";
import { buildRecommendations } from "@/lib/ava/core/recommendations";
import { buildAvaSnapshot, parseAvaSnapshot } from "@/lib/ava/core/snapshot";
import { determineAvaStatus } from "@/lib/ava/core/status";
import { buildAvaCognitiveState } from "@/lib/ava/core/state";
import { diffAvaSnapshots } from "@/lib/ava/core/diff";
import { changeToEvent, summarizeChanges } from "@/lib/ava/core/changes";
import { mergeObservationAndChangeEvents } from "@/lib/ava/core/timeline";
import type { AvaChange, AvaExecutiveContext, AvaPriority } from "@/lib/ava/core/types";

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function sourceStatus(source: string | undefined) {
  return source || "executive-context";
}

function buildSummaryText(context: {
  kind: "business" | "personal" | "automation" | "calendar" | "weather";
  awareness: Record<string, unknown>;
  risks: AvaPriority[];
}) {
  const tasks = asRecord(context.awareness.tasks);
  const groups = asRecord(tasks.groups);
  const weather = asRecord(context.awareness.weather);
  const projects = asRecord(context.awareness.projects);
  const gmail = asRecord(context.awareness.gmail);
  const calendar = asRecord(context.awareness.calendar);
  const automationRisk = context.risks.find((risk) => risk.entityType === "Automation");

  if (context.kind === "business") return `I found ${Number(projects.count || 0)} project records with ${Number(projects.active || 0)} active, ready, or prototyped.`;
  if (context.kind === "personal") return `I see ${Array.isArray(groups.today) ? groups.today.length : 0} Todoist items due today, ${Array.isArray(groups.overdue) ? groups.overdue.length : 0} overdue, and ${Number(gmail.attentionCount || 0)} Gmail items in the attention scan.`;
  if (context.kind === "automation") return automationRisk?.title || "I do not see unresolved automation events right now.";
  if (context.kind === "calendar") return `I found ${Array.isArray(calendar.todayItems) ? calendar.todayItems.length : 0} scheduled Todoist items for today and ${Array.isArray(calendar.upcomingItems) ? calendar.upcomingItems.length : 0} upcoming.`;
  return `I am tracking ${String(weather.condition || "current weather").toLowerCase()} at ${Number(weather.temperature || 0)}°, with ${Number(weather.rainChance || 0)}% rain chance.`;
}

function priorityFeedItem(priority: AvaPriority) {
  return {
    id: `priority:${priority.id}`,
    timestamp: "Now",
    category: priority.summary.split(" signal")[0] || "priority",
    title: priority.title,
    summary: priority.summary,
    severity: priority.severity === "urgent" ? "warning" : priority.severity,
    action: "Review",
  };
}

function changeFeedItem(change: AvaChange) {
  return {
    id: `change:${change.id}`,
    timestamp: "Changed",
    category: change.category,
    title: change.summary,
    summary: change.recommendedAction,
    severity: change.severity === "urgent" ? "warning" : change.severity,
    action: "Review Change",
  };
}

function buildExecutiveFeed(context: {
  priorities: AvaPriority[];
  changes: AvaChange[];
  awareness: Record<string, unknown>;
}) {
  const priorities = context.priorities.map(priorityFeedItem);
  const changes = context.changes.filter((change) => change.visibility === "user" && change.classification !== "Hidden").map(changeFeedItem);
  const tasks = asRecord(context.awareness.tasks);
  const groups = asRecord(tasks.groups);
  const weather = asRecord(context.awareness.weather);
  const projects = asRecord(context.awareness.projects);

  return [
    ...changes,
    ...priorities,
    {
      id: "executive-todoist",
      timestamp: "Now",
      category: "task",
      title: `I loaded ${Array.isArray(tasks.tasks) ? tasks.tasks.length : 0} Todoist item${Array.isArray(tasks.tasks) && tasks.tasks.length === 1 ? "" : "s"}`,
      summary: `I found ${Array.isArray(groups.scheduled) ? groups.scheduled.length : 0} scheduled, ${Array.isArray(groups.unscheduled) ? groups.unscheduled.length : 0} unscheduled, and ${Array.isArray(groups.overdue) ? groups.overdue.length : 0} overdue.`,
      severity: Array.isArray(groups.overdue) && groups.overdue.length ? "warning" : "normal",
      action: "Open Tasks",
    },
    {
      id: "executive-weather",
      timestamp: "Now",
      category: "weather",
      title: `I am tracking ${Number(weather.temperature || 0)}° and ${String(weather.condition || "current weather").toLowerCase()}`,
      summary: `I see a high of ${Number(weather.high || 0)}°, low of ${Number(weather.low || 0)}°, and ${Number(weather.rainChance || 0)}% rain chance. ${String(weather.recommendation || "")}`,
      severity: Number(weather.rainChance || 0) >= 50 ? "warning" : "normal",
      action: "Review Weather",
    },
    {
      id: "executive-projects",
      timestamp: "Now",
      category: "project",
      title: `I found ${Number(projects.count || 0)} local project records`,
      summary: `I am keeping ${Number(projects.active || 0)} active, ready, or prototyped projects close in the local workspace registry.`,
      severity: "normal",
      action: "Open Projects",
    },
  ].slice(0, 12);
}

export async function getAvaExecutiveContext({ previousSnapshot }: { previousSnapshot?: unknown } = {}): Promise<AvaExecutiveContext> {
  const cognitiveState = await buildAvaCognitiveState();
  const currentSnapshot = buildAvaSnapshot(cognitiveState);
  const parsedPreviousSnapshot = parseAvaSnapshot(previousSnapshot);
  const recentChanges = diffAvaSnapshots(parsedPreviousSnapshot, currentSnapshot);
  const changeEvents = recentChanges.map(changeToEvent);
  const timeline = mergeObservationAndChangeEvents(cognitiveState.timeline, changeEvents);
  const focusItems = buildFocusPlan(cognitiveState.reasoning, recentChanges);
  const recommendedActions = buildRecommendations({ reasoning: cognitiveState.reasoning, recentChanges });
  const missionStatus = determineAvaStatus({
    reasoning: cognitiveState.reasoning,
    timelineSummary: cognitiveState.timelineSummary,
    recentChanges,
  });
  const awareness = cognitiveState.awareness as unknown as Record<string, unknown>;
  const contextBase = {
    generatedAt: new Date().toISOString(),
    missionStatus,
    topPriorities: focusItems.topPriorities,
    focusItems,
    recentChanges,
    activeRisks: cognitiveState.reasoning.openRisks,
    businessSummary: buildSummaryText({ kind: "business", awareness, risks: cognitiveState.reasoning.openRisks }),
    personalSummary: buildSummaryText({ kind: "personal", awareness, risks: cognitiveState.reasoning.openRisks }),
    automationSummary: buildSummaryText({ kind: "automation", awareness, risks: cognitiveState.reasoning.openRisks }),
    calendarSummary: buildSummaryText({ kind: "calendar", awareness, risks: cognitiveState.reasoning.openRisks }),
    weatherSummary: buildSummaryText({ kind: "weather", awareness, risks: cognitiveState.reasoning.openRisks }),
    pendingApprovals: cognitiveState.reasoning.pendingApprovals,
    recommendedActions,
    dailyBrief: null,
    intelligenceFeed: [],
    raw: {
      cognitiveState: {
        ...cognitiveState,
        timeline,
      },
      currentSnapshot,
      previousSnapshot: parsedPreviousSnapshot,
      changeEvents,
    },
  } satisfies Omit<AvaExecutiveContext, "dailyBrief" | "intelligenceFeed"> & { dailyBrief: null; intelligenceFeed: [] };
  const dailyBrief = buildExecutiveDailyBrief(contextBase);
  const intelligenceFeed = buildExecutiveFeed({
    priorities: focusItems.topPriorities,
    changes: recentChanges,
    awareness,
  });

  return {
    ...contextBase,
    dailyBrief: {
      ...dailyBrief,
      source: {
        ...dailyBrief.source,
        executiveContext: sourceStatus("active"),
        changeSummary: summarizeChanges(recentChanges),
      },
    },
    intelligenceFeed,
  };
}
