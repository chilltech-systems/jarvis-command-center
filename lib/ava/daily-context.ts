import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvaExecutiveContext } from "@/lib/ava/core/executive-context";
import type { AvaExecutiveContext } from "@/lib/ava/core/types";
import { buildAvaCompletedTasks } from "@/lib/ava/completed-tasks";
import { getAvaConnections } from "@/lib/ava/connections";
import { buildAvaGmailAttentionFromBatch } from "@/lib/ava/gmail-attention";
import { getProjectSummary } from "@/lib/ava/projects";
import {
  buildAvaScheduleFromTasks,
  buildAvaTasksFromTodoist,
} from "@/lib/ava/todoist";
import { getAvaWeather } from "@/lib/ava/weather";
import { getCentralDayWindow } from "@/lib/ava/time";
import { automationSnapshot, tasks as mockTasks, weather as mockWeather } from "@/lib/mock-data/ava";
import { callToolHub, type TodoistTask } from "@/lib/jarvis/tool-hub";

export const AVA_CONTEXT_DAILY_LIMIT = 12;
export const AVA_CONTEXT_EXPECTED_EXECUTIONS = 3;
export const AVA_CONTEXT_SCOPE = "ava_core_daily_snapshot";

export type AvaContextRefreshKind = "automatic" | "manual";
export type AvaContextRefreshStatus = "success" | "partial" | "failed" | "blocked";

export type AvaContextUsage = {
  centralDate: string;
  reservedExecutions: number;
  remainingExecutions: number;
  automaticAttempts: number;
  manualOverrideUsed: boolean;
  refreshInProgress: boolean;
  lastStatus: string;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
  stopEngaged: boolean;
  retryState: "not_started" | "retry_available" | "retry_used" | "complete" | "in_progress";
};

export type AvaStoredDailyContext = {
  schemaVersion: 1;
  centralDate: string;
  generatedAt: string;
  refreshKind: AvaContextRefreshKind;
  sourceFailures: string[];
  sourceStatus: Record<string, { status: "success" | "failed"; error: string | null }>;
  context: AvaExecutiveContext;
};

export type AvaDailyContextEnvelope = AvaStoredDailyContext & {
  freshness: "fresh" | "stale" | "fallback";
  snapshotAgeMs: number;
  usage: AvaContextUsage;
};

type AvaContextBatch = {
  todoist?: {
    tasks?: TodoistTask[];
    completed?: unknown;
  };
  gmail?: {
    "chill-tech"?: unknown;
    idad?: unknown;
  };
  sourceFailures?: string[];
  sourceStatus?: Record<string, { ok?: boolean; error?: string | null }>;
};

type UsageRow = {
  central_date: string;
  reserved_executions: number;
  automatic_attempts: number;
  manual_override_used: boolean;
  refresh_in_progress: boolean;
  last_status: string;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_error: string | null;
};

export function getCentralDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function asStoredContext(value: unknown): AvaStoredDailyContext | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AvaStoredDailyContext>;
  if (
    candidate.schemaVersion !== 1
    || typeof candidate.centralDate !== "string"
    || typeof candidate.generatedAt !== "string"
    || !candidate.context
    || !Array.isArray(candidate.sourceFailures)
  ) return null;
  return candidate as AvaStoredDailyContext;
}

function defaultUsage(centralDate: string): AvaContextUsage {
  return {
    centralDate,
    reservedExecutions: 0,
    remainingExecutions: AVA_CONTEXT_DAILY_LIMIT,
    automaticAttempts: 0,
    manualOverrideUsed: false,
    refreshInProgress: false,
    lastStatus: "idle",
    lastStartedAt: null,
    lastCompletedAt: null,
    lastError: null,
    stopEngaged: false,
    retryState: "not_started",
  };
}

function mapUsage(row: UsageRow | null | undefined, centralDate: string): AvaContextUsage {
  if (!row) return defaultUsage(centralDate);
  const remainingExecutions = Math.max(0, AVA_CONTEXT_DAILY_LIMIT - row.reserved_executions);
  const retryState = row.refresh_in_progress
    ? "in_progress"
    : row.last_status === "failed" && row.automatic_attempts === 1
      ? "retry_available"
      : row.automatic_attempts >= 2
        ? "retry_used"
        : row.last_status === "success" || row.last_status === "partial"
          ? "complete"
          : "not_started";
  return {
    centralDate: row.central_date,
    reservedExecutions: row.reserved_executions,
    remainingExecutions,
    automaticAttempts: row.automatic_attempts,
    manualOverrideUsed: row.manual_override_used,
    refreshInProgress: row.refresh_in_progress,
    lastStatus: row.last_status,
    lastStartedAt: row.last_started_at,
    lastCompletedAt: row.last_completed_at,
    lastError: row.last_error,
    stopEngaged: row.refresh_in_progress || row.automatic_attempts >= 2 || remainingExecutions < AVA_CONTEXT_EXPECTED_EXECUTIONS,
    retryState,
  };
}

function fallbackTaskData() {
  const todoistTasks: TodoistTask[] = mockTasks.map((task) => ({
    id: task.id,
    content: task.title,
    priority: task.priority,
    due: task.dueDate === "Yesterday"
      ? { date: "2000-01-01" }
      : task.dueDate === "Tomorrow"
        ? { string: "tomorrow" }
        : { string: "today" },
  }));
  return buildAvaTasksFromTodoist(todoistTasks, "No persisted daily context is available yet.");
}

async function buildFallbackContext() {
  const taskData = fallbackTaskData();
  const schedule = buildAvaScheduleFromTasks(taskData);
  const completed = buildAvaCompletedTasks([], "No persisted daily context is available yet.");
  const gmail = buildAvaGmailAttentionFromBatch({
    messages: {},
    errors: {
      "chill-tech": "No persisted daily context is available yet.",
      idad: "No persisted daily context is available yet.",
    },
  });
  return getAvaExecutiveContext({
    awarenessDependencies: {
      tasks: async () => taskData,
      completedTasks: async () => completed,
      weather: async () => ({ ...mockWeather, source: "mock", error: "No persisted daily context is available yet.", updatedAt: new Date().toISOString() }),
      projects: getProjectSummary,
      gmail: async () => gmail,
      schedule: async () => schedule,
      connections: getAvaConnections,
      automation: async () => automationSnapshot,
    },
  });
}

export async function getAvaFallbackDailyContext(now = new Date()): Promise<AvaDailyContextEnvelope> {
  const centralDate = getCentralDateKey(now);
  const context = await buildFallbackContext();
  return {
    schemaVersion: 1,
    centralDate,
    generatedAt: context.generatedAt,
    refreshKind: "automatic",
    sourceFailures: ["daily-context"],
    sourceStatus: { "daily-context": { status: "failed", error: "No persisted daily context is available yet." } },
    context,
    freshness: "fallback",
    snapshotAgeMs: 0,
    usage: defaultUsage(centralDate),
  };
}

async function readUsage(supabase: SupabaseClient, ownerId: string, centralDate: string) {
  const { data } = await supabase
    .from("ava_context_refresh_usage")
    .select("central_date,reserved_executions,automatic_attempts,manual_override_used,refresh_in_progress,last_status,last_started_at,last_completed_at,last_error")
    .eq("owner_id", ownerId)
    .eq("central_date", centralDate)
    .maybeSingle();
  return mapUsage(data as UsageRow | null, centralDate);
}

async function readStoredContext(supabase: SupabaseClient, ownerId: string) {
  const { data } = await supabase
    .from("jarvis_memory")
    .select("memory_key,content,updated_at")
    .eq("owner_id", ownerId)
    .eq("scope", AVA_CONTEXT_SCOPE)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    stored: asStoredContext(data?.content),
    updatedAt: typeof data?.updated_at === "string" ? data.updated_at : null,
  };
}

export async function getAvaDailyContext({
  supabase,
  ownerId,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  ownerId: string;
  now?: Date;
}): Promise<AvaDailyContextEnvelope> {
  const centralDate = getCentralDateKey(now);
  const [{ stored, updatedAt }, usage] = await Promise.all([
    readStoredContext(supabase, ownerId),
    readUsage(supabase, ownerId, centralDate),
  ]);
  if (!stored) {
    return { ...(await getAvaFallbackDailyContext(now)), usage };
  }
  const generatedTime = Date.parse(updatedAt || stored.generatedAt);
  return {
    ...stored,
    freshness: stored.centralDate === centralDate ? "fresh" : "stale",
    snapshotAgeMs: Number.isNaN(generatedTime) ? 0 : Math.max(0, now.getTime() - generatedTime),
    usage,
  };
}

async function reserveUsage({
  supabase,
  ownerId,
  centralDate,
  kind,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  centralDate: string;
  kind: AvaContextRefreshKind;
}) {
  const { data, error } = await supabase.rpc("reserve_ava_context_refresh", {
    p_owner_id: ownerId,
    p_central_date: centralDate,
    p_expected_executions: AVA_CONTEXT_EXPECTED_EXECUTIONS,
    p_kind: kind,
    p_daily_limit: AVA_CONTEXT_DAILY_LIMIT,
  });
  if (error) throw new Error(`Unable to reserve Ava context usage: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    granted: row?.granted === true,
    attemptId: typeof row?.attempt_id === "string" ? row.attempt_id : null,
    reason: typeof row?.reason === "string" ? row.reason : null,
  };
}

async function finalizeUsage({
  supabase,
  ownerId,
  centralDate,
  attemptId,
  status,
  sourceFailures,
  error,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  centralDate: string;
  attemptId: string;
  status: AvaContextRefreshStatus;
  sourceFailures: string[];
  error?: string | null;
}) {
  await supabase
    .from("ava_context_refresh_usage")
    .update({
      refresh_in_progress: false,
      last_status: status,
      last_completed_at: new Date().toISOString(),
      last_error: error || null,
      source_failures: sourceFailures,
    })
    .eq("owner_id", ownerId)
    .eq("central_date", centralDate);
  await supabase
    .from("ava_context_refresh_attempts")
    .update({
      status,
      completed_at: new Date().toISOString(),
      error_message: error || null,
      source_failures: sourceFailures,
    })
    .eq("attempt_id", attemptId)
    .eq("owner_id", ownerId);
}

function previousAwareness(previous: AvaStoredDailyContext | null) {
  return previous?.context.raw.cognitiveState.awareness;
}

async function buildContextFromBatch(batch: AvaContextBatch, previous: AvaStoredDailyContext | null) {
  const failures = Array.from(new Set((batch.sourceFailures || []).filter((value) => typeof value === "string")));
  const prior = previousAwareness(previous);
  const taskFailure = failures.includes("todoist:tasks");
  const completedFailure = failures.includes("todoist:completed");
  const gmailFailure = failures.some((failure) => failure.startsWith("gmail"));
  const liveTasks = buildAvaTasksFromTodoist(batch.todoist?.tasks || [], taskFailure ? "Todoist batch read failed." : null);
  const tasks = taskFailure && prior?.tasks ? prior.tasks as typeof liveTasks : liveTasks;
  const liveCompleted = buildAvaCompletedTasks(batch.todoist?.completed, completedFailure ? "Todoist completed-task batch read failed." : null);
  const completedTasks = completedFailure && prior?.completedTasks ? prior.completedTasks as typeof liveCompleted : liveCompleted;
  const liveGmail = buildAvaGmailAttentionFromBatch({
    messages: batch.gmail || {},
    errors: {
      "chill-tech": failures.includes("gmail:chill-tech") ? "CHILL TECH Gmail batch read failed." : null,
      idad: failures.includes("gmail:idad") ? "IDAD Gmail batch read failed." : null,
    },
  });
  const gmail = gmailFailure && prior?.gmail ? prior.gmail as typeof liveGmail : liveGmail;
  const schedule = taskFailure && prior?.calendar
    ? prior.calendar as ReturnType<typeof buildAvaScheduleFromTasks>
    : buildAvaScheduleFromTasks(tasks);
  const liveWeather = await getAvaWeather();
  const weatherError = "error" in liveWeather ? liveWeather.error : null;
  const weather = weatherError && prior?.weather ? prior.weather as typeof liveWeather : liveWeather;
  if (weatherError) failures.push("weather");

  const context = await getAvaExecutiveContext({
    awarenessDependencies: {
      tasks: async () => tasks,
      completedTasks: async () => completedTasks,
      weather: async () => weather,
      projects: getProjectSummary,
      gmail: async () => gmail,
      schedule: async () => schedule,
      connections: getAvaConnections,
      automation: async () => automationSnapshot,
    },
  });
  const sourceFailures = Array.from(new Set(failures));
  const sourceStatus = Object.fromEntries([
    "todoist:tasks",
    "todoist:completed",
    "gmail:chill-tech",
    "gmail:idad",
    "weather",
  ].map((source) => {
    const batchStatus = batch.sourceStatus?.[source];
    const failed = sourceFailures.includes(source);
    return [source, {
      status: failed ? "failed" as const : "success" as const,
      error: failed ? batchStatus?.error || (source === "weather" ? weatherError || "Weather read failed." : `${source} read failed.`) : null,
    }];
  }));
  return { context, sourceFailures, sourceStatus };
}

export async function refreshAvaDailyContext({
  supabase,
  ownerId,
  kind,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  ownerId: string;
  kind: AvaContextRefreshKind;
  now?: Date;
}) {
  const centralDate = getCentralDateKey(now);
  const reservation = await reserveUsage({ supabase, ownerId, centralDate, kind });
  if (!reservation.granted) {
    return {
      status: "blocked" as const,
      reason: reservation.reason || "usage_stop_engaged",
      context: await getAvaDailyContext({ supabase, ownerId, now }),
    };
  }

  const { stored: previous } = await readStoredContext(supabase, ownerId);
  try {
    const { since, until } = getCentralDayWindow(now);
    const batchResponse = await callToolHub<AvaContextBatch>({
      tool: "ava.context.refresh",
      parameters: { centralDate, since, until },
      user: "cody",
      timeoutMs: 20_000,
    });
    if (!batchResponse.success || !batchResponse.data) {
      throw new Error(batchResponse.error || "Ava context batch returned no data.");
    }
    const completeFailureSources = ["todoist:tasks", "todoist:completed", "gmail:chill-tech", "gmail:idad"];
    if (completeFailureSources.every((source) => batchResponse.data?.sourceFailures?.includes(source))) {
      throw new Error("All Ava context batch sources failed.");
    }
    const { context, sourceFailures, sourceStatus } = await buildContextFromBatch(batchResponse.data, previous);
    const stored: AvaStoredDailyContext = {
      schemaVersion: 1,
      centralDate,
      generatedAt: context.generatedAt,
      refreshKind: kind,
      sourceFailures,
      sourceStatus,
      context,
    };
    const { error: storeError } = await supabase.from("jarvis_memory").upsert({
      owner_id: ownerId,
      scope: AVA_CONTEXT_SCOPE,
      memory_key: centralDate,
      source: "ava-daily-context",
      confidence: sourceFailures.length ? 0.8 : 1,
      active: true,
      content: JSON.parse(JSON.stringify(stored)),
    }, { onConflict: "owner_id,scope,memory_key" });
    if (storeError) throw new Error(`Unable to store Ava daily context: ${storeError.message}`);
    const status = sourceFailures.length ? "partial" as const : "success" as const;
    await finalizeUsage({ supabase, ownerId, centralDate, attemptId: reservation.attemptId!, status, sourceFailures });
    return {
      status,
      reason: null,
      context: await getAvaDailyContext({ supabase, ownerId, now }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ava context refresh failed.";
    await finalizeUsage({
      supabase,
      ownerId,
      centralDate,
      attemptId: reservation.attemptId!,
      status: "failed",
      sourceFailures: ["context-batch"],
      error: message,
    });
    return {
      status: "failed" as const,
      reason: message,
      context: await getAvaDailyContext({ supabase, ownerId, now }),
    };
  }
}
