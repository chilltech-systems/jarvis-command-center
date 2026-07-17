import { getAvaCompletedTasks } from "@/lib/ava/completed-tasks";
import { getAvaConnections } from "@/lib/ava/connections";
import { getAvaGmailAttention } from "@/lib/ava/gmail-attention";
import { getProjectSummary } from "@/lib/ava/projects";
import { getAvaTasks, getAvaSchedule } from "@/lib/ava/todoist";
import { getAvaWeather } from "@/lib/ava/weather";
import type { AvaAwarenessSnapshot, AvaSourceState } from "@/lib/ava/core/types";

export type AvaAwarenessDependencies = {
  tasks: typeof getAvaTasks;
  completedTasks: typeof getAvaCompletedTasks;
  weather: typeof getAvaWeather;
  projects?: typeof getProjectSummary;
  gmail: typeof getAvaGmailAttention;
  schedule: typeof getAvaSchedule;
  connections: typeof getAvaConnections;
  automation?: () => unknown | Promise<unknown>;
};

const DEFAULT_DEPENDENCIES: AvaAwarenessDependencies = {
  tasks: getAvaTasks,
  completedTasks: getAvaCompletedTasks,
  weather: getAvaWeather,
  gmail: getAvaGmailAttention,
  schedule: getAvaSchedule,
  connections: getAvaConnections,
};

function sourceState(source: string, error?: string | null): AvaSourceState {
  const normalizedSource = source.toLowerCase();
  const status = error ? "fallback" : normalizedSource.includes("mock") ? "fallback" : normalizedSource.includes("unavailable") ? "unavailable" : "live";
  return {
    source,
    status,
    freshness: status === "live" ? "fresh" : "unknown",
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

export async function buildAvaAwareness(
  dependencyOverrides: Partial<AvaAwarenessDependencies> = {},
): Promise<AvaAwarenessSnapshot> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const [tasks, completedTasks, weather, projects, gmail, schedule] = await Promise.all([
    dependencies.tasks(),
    dependencies.completedTasks(),
    dependencies.weather(),
    dependencies.projects ? Promise.resolve(dependencies.projects()) : Promise.resolve(undefined),
    dependencies.gmail(),
    dependencies.schedule(),
  ]);
  const [connections, automation] = await Promise.all([
    Promise.resolve(dependencies.connections()),
    dependencies.automation ? Promise.resolve(dependencies.automation()) : Promise.resolve(undefined),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    tasks,
    completedTasks,
    weather,
    projects,
    gmail,
    calendar: schedule,
    automation,
    connections,
    sources: {
      tasks: sourceState(getSource(tasks, "todoist"), getError(tasks)),
      completedTasks: sourceState(getSource(completedTasks, "todoist-completed"), getError(completedTasks)),
      weather: sourceState(getSource(weather, "weather"), getError(weather)),
      projects: projects === undefined
        ? sourceState("unavailable-projects")
        : sourceState(getSource(projects, "project-summary"), getError(projects)),
      gmail: sourceState(getSource(gmail, "gmail"), getError(gmail)),
      calendar: sourceState(getSource(schedule, "schedule"), getError(schedule)),
      automation: automation === undefined
        ? sourceState("unavailable-automation")
        : sourceState(getSource(automation, "n8n-summary"), getError(automation)),
      connections: sourceState("connection-catalog"),
    },
  };
}
