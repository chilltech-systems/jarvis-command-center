import type {
  AvaCoreJson,
  AvaEntityType,
  AvaEvent,
  AvaEventCategory,
  AvaEventSource,
  AvaRelatedEntity,
  AvaSeverity,
  AvaVisibility,
} from "@/lib/ava/core/types";

type EventInput<TPayload extends AvaCoreJson = AvaCoreJson> = {
  id?: string;
  timestamp?: string;
  source: AvaEventSource;
  category: AvaEventCategory;
  severity?: AvaSeverity;
  entityType: AvaEntityType;
  entityId: string;
  summary: string;
  payload?: TPayload;
  relatedEntities?: AvaRelatedEntity[];
  visibility?: AvaVisibility;
};

function stableId(parts: Array<string | number | null | undefined>) {
  return parts.filter((part) => part !== null && part !== undefined && String(part).length > 0).join(":");
}

function asPayload(value: unknown): AvaCoreJson {
  return JSON.parse(JSON.stringify(value ?? {})) as AvaCoreJson;
}

export function createAvaEvent<TPayload extends AvaCoreJson = AvaCoreJson>(input: EventInput<TPayload>): AvaEvent<TPayload> {
  const timestamp = input.timestamp || new Date().toISOString();

  return {
    id: input.id || stableId([input.source, input.category, input.entityType, input.entityId, timestamp]),
    timestamp,
    source: input.source,
    category: input.category,
    severity: input.severity || "normal",
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    payload: input.payload ?? ({} as TPayload),
    relatedEntities: input.relatedEntities || [],
    visibility: input.visibility || "user",
  };
}

export function normalizeTaskEvents(tasks: unknown): AvaEvent[] {
  const items = Array.isArray((tasks as { tasks?: unknown[] })?.tasks) ? (tasks as { tasks: Array<Record<string, unknown>> }).tasks : [];

  return items.map((task) => createAvaEvent({
    id: stableId(["todoist", "task", String(task.id || task.title)]),
    timestamp: new Date().toISOString(),
    source: "todoist",
    category: "task",
    severity: task.status === "overdue" || Number(task.priority || 4) <= 1 ? "warning" : "normal",
    entityType: "Task",
    entityId: String(task.id || task.title || "unknown-task"),
    summary: String(task.title || "Todoist task"),
    payload: asPayload(task),
    relatedEntities: task.project ? [{ type: "Project", id: String(task.project), relationship: "belongs_to" }] : [],
  }));
}

export function normalizeCompletedTaskEvents(completedTasks: unknown): AvaEvent[] {
  const items = Array.isArray((completedTasks as { completedToday?: unknown[] })?.completedToday)
    ? (completedTasks as { completedToday: Array<Record<string, unknown>> }).completedToday
    : [];

  return items.map((task) => createAvaEvent({
    id: stableId(["todoist", "completed", String(task.id || task.title)]),
    timestamp: String(task.completedAt || new Date().toISOString()),
    source: "todoist",
    category: "task",
    severity: "info",
    entityType: "Task",
    entityId: String(task.id || task.title || "completed-task"),
    summary: `Completed: ${String(task.title || "Todoist task")}`,
    payload: asPayload(task),
    relatedEntities: task.project ? [{ type: "Project", id: String(task.project), relationship: "completed_in" }] : [],
  }));
}

export function normalizeGmailEvents(gmail: unknown): AvaEvent[] {
  const accounts = Array.isArray((gmail as { accounts?: unknown[] })?.accounts)
    ? (gmail as { accounts: Array<{ items?: Array<Record<string, unknown>> }> }).accounts
    : [];

  return accounts.flatMap((account) => (account.items || []).map((item) => createAvaEvent({
    id: stableId(["gmail", String(item.account), String(item.id || item.threadId || item.subject)]),
    timestamp: String(item.receivedAt || new Date().toISOString()),
    source: "gmail",
    category: "email",
    severity: item.severity === "urgent" ? "urgent" : item.severity === "warning" ? "warning" : "normal",
    entityType: "Conversation",
    entityId: String(item.threadId || item.id || item.subject || "gmail-thread"),
    summary: String(item.subject || "Gmail item"),
    payload: asPayload(item),
    visibility: "user",
  })));
}

export function normalizeWeatherEvent(weather: unknown): AvaEvent[] {
  if (!weather || typeof weather !== "object") return [];
  const data = weather as Record<string, unknown>;
  const rainChance = Number(data.rainChance || 0);
  const condition = String(data.condition || "weather");

  return [createAvaEvent({
    id: stableId(["weather", String(data.location || "current")]),
    timestamp: String(data.updatedAt || new Date().toISOString()),
    source: "weather",
    category: "weather",
    severity: rainChance >= 55 || /storm|heavy|thunder/i.test(condition) ? "warning" : "normal",
    entityType: "Weather",
    entityId: String(data.location || "current-weather"),
    summary: `${String(data.location || "Weather")}: ${String(data.temperature || "")} ${condition}`.trim(),
    payload: asPayload(data),
  })];
}

export function normalizeProjectEvents(projects: unknown): AvaEvent[] {
  const items = Array.isArray((projects as { projects?: unknown[] })?.projects)
    ? (projects as { projects: Array<Record<string, unknown>> }).projects
    : Array.isArray(projects) ? projects as Array<Record<string, unknown>> : [];

  return items.map((project) => createAvaEvent({
    id: stableId(["project", String(project.name)]),
    timestamp: new Date().toISOString(),
    source: "project",
    category: "project",
    severity: project.status === "Active" || project.status === "Ready" ? "normal" : "info",
    entityType: "Project",
    entityId: String(project.name || "project"),
    summary: `${String(project.name || "Project")}: ${String(project.nextAction || project.status || "tracked")}`,
    payload: asPayload(project),
  }));
}

export function normalizeConnectionEvents(connections: unknown): AvaEvent[] {
  const items = Array.isArray(connections) ? connections as Array<Record<string, unknown>> : [];

  return items.map((connection) => {
    const status = String(connection.status || "unknown");
    return createAvaEvent({
      id: stableId(["connection", String(connection.name)]),
      timestamp: new Date().toISOString(),
      source: "connection",
      category: "connection",
      severity: status === "Connected" || status === "Credential Found" ? "info" : "warning",
      entityType: "Connection",
      entityId: String(connection.name || "connection"),
      summary: `${String(connection.name || "Connection")}: ${status}`,
      payload: asPayload(connection),
      visibility: status === "Connected" ? "internal" : "user",
    });
  });
}

export function normalizeAutomationEvents(automation: unknown): AvaEvent[] {
  if (!automation || typeof automation !== "object") return [];
  const data = automation as Record<string, unknown>;
  const failed = Number(data.failedWorkflows || data.criticalWorkflows || 0);
  const warning = Number(data.warningWorkflows || 0);

  return [createAvaEvent({
    id: "n8n:automation:overview",
    timestamp: new Date().toISOString(),
    source: "n8n",
    category: "automation",
    severity: failed > 0 ? "urgent" : warning > 0 ? "warning" : "normal",
    entityType: "Automation",
    entityId: "n8n-overview",
    summary: String(data.latestFailure || data.summary || "Automation overview"),
    payload: asPayload(data),
  })];
}

export function normalizeAwarenessEvents(awareness: {
  tasks?: unknown;
  completedTasks?: unknown;
  weather?: unknown;
  projects?: unknown;
  gmail?: unknown;
  connections?: unknown;
  automation?: unknown;
  sources?: Record<string, { status?: string }>;
}) {
  const usable = (source: string) => awareness.sources?.[source]?.status === "live";
  return [
    ...(usable("tasks") ? normalizeTaskEvents(awareness.tasks) : []),
    ...(usable("completedTasks") ? normalizeCompletedTaskEvents(awareness.completedTasks) : []),
    ...(usable("gmail") ? normalizeGmailEvents(awareness.gmail) : []),
    ...(usable("weather") ? normalizeWeatherEvent(awareness.weather) : []),
    ...(usable("projects") ? normalizeProjectEvents(awareness.projects) : []),
    ...(usable("connections") ? normalizeConnectionEvents(awareness.connections) : []),
    ...(usable("automation") ? normalizeAutomationEvents(awareness.automation) : []),
  ];
}
