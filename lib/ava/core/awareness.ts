import { automationSnapshot } from "@/lib/mock-data/ava";
import { getAvaCompletedTasks } from "@/lib/ava/completed-tasks";
import { getAvaConnections } from "@/lib/ava/connections";
import { getAvaGmailAttention } from "@/lib/ava/gmail-attention";
import { getProjectSummary } from "@/lib/ava/projects";
import { getAvaTasks, getAvaSchedule } from "@/lib/ava/todoist";
import { getAvaWeather } from "@/lib/ava/weather";
import type { AvaAwarenessSnapshot, AvaSourceState } from "@/lib/ava/core/types";

function sourceState(source: string, error?: string | null): AvaSourceState {
  return {
    source,
    status: error ? "fallback" : source.includes("mock") || source.includes("unavailable") ? "fallback" : "live",
    error: error || null,
    updatedAt: new Date().toISOString(),
  };
}

function getSource(value: unknown, fallback: string) {
  return String((value as { source?: unknown })?.source || fallback);
}

function getError(value: unknown) {
  const error = (value as { error?: unknown })?.error;
  return typeof error === "string" ? error : null;
}

export async function buildAvaAwareness(): Promise<AvaAwarenessSnapshot> {
  const [tasks, completedTasks, weather, projects, gmail, schedule] = await Promise.all([
    getAvaTasks(),
    getAvaCompletedTasks(),
    getAvaWeather(),
    Promise.resolve(getProjectSummary()),
    getAvaGmailAttention(),
    getAvaSchedule(),
  ]);
  const connections = getAvaConnections();

  return {
    generatedAt: new Date().toISOString(),
    tasks,
    completedTasks,
    weather,
    projects,
    gmail,
    calendar: schedule,
    automation: automationSnapshot,
    connections,
    sources: {
      tasks: sourceState(getSource(tasks, "todoist"), getError(tasks)),
      completedTasks: sourceState(getSource(completedTasks, "todoist-completed"), getError(completedTasks)),
      weather: sourceState(getSource(weather, "weather"), getError(weather)),
      projects: sourceState(getSource(projects, "project-summary"), getError(projects)),
      gmail: sourceState(getSource(gmail, "gmail"), getError(gmail)),
      calendar: sourceState(getSource(schedule, "schedule"), getError(schedule)),
      automation: sourceState("n8n-summary"),
      connections: sourceState("connection-catalog"),
    },
  };
}
