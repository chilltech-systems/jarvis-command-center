import { getAvaCompletedTasks } from "@/lib/ava/completed-tasks";
import { getAvaConnections } from "@/lib/ava/connections";
import { getAvaTasks } from "@/lib/ava/todoist";
import { getProjectSummary } from "@/lib/ava/projects";
import { JARVIS_TOOLS } from "@/lib/jarvis/tool-registry";

type SupabaseClient = any;

type QueryResult<T> = Promise<{ data: T | null; error?: { message?: string } | null }>;

const CENTRAL_TIME_ZONE = "America/Chicago";
const SNAPSHOT_SCOPE = "dashboard_daily_snapshot";

function centralDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTRAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function routeLabel(path: string) {
  if (path === "/") return "Home";
  const segment = path.split("/").filter(Boolean)[0] || "home";
  return segment.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function capabilitySummary() {
  const ready = JARVIS_TOOLS.filter((tool) => tool.status === "available" && tool.permission !== "requires_approval");
  const approvalRequired = JARVIS_TOOLS.filter((tool) => tool.status === "available" && tool.permission === "requires_approval");
  const planned = JARVIS_TOOLS.filter((tool) => tool.status === "planned");
  const blocked = JARVIS_TOOLS.filter((tool) => tool.status === "credential_needed");

  return {
    readyCount: ready.length,
    approvalRequiredCount: approvalRequired.length,
    plannedCount: planned.length,
    blockedCount: blocked.length,
    ready: ready.map((tool) => tool.name),
    approvalRequired: approvalRequired.map((tool) => tool.name),
    planned: planned.map((tool) => tool.name),
    blocked: blocked.map((tool) => tool.name),
  };
}

export async function buildDashboardContext({
  supabase,
  ownerId,
  path,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  path: string;
}) {
  const safePath = path.startsWith("/") ? path : "/";
  const [tasks, completedTasks, projects, connections, overviewResult, activityResult, issuesResult] = await Promise.all([
    getAvaTasks(),
    getAvaCompletedTasks(),
    Promise.resolve(getProjectSummary()),
    Promise.resolve(getAvaConnections()),
    supabase.from("jarvis_hud_overview").select("*").limit(1).maybeSingle() as QueryResult<Record<string, unknown>>,
    supabase.from("jarvis_recent_activity").select("source_name,summary,status,severity,occurred_at").order("occurred_at", { ascending: false }).limit(5) as QueryResult<Array<Record<string, unknown>>>,
    supabase.from("jarvis_open_issues").select("source_workflow,summary,severity,urgency,occurred_at").order("occurred_at", { ascending: false }).limit(5) as QueryResult<Array<Record<string, unknown>>>,
  ]);

  const connectedConnections = connections.filter((connection) => connection.status === "Connected").length;
  const context = {
    ownerId,
    path: safePath,
    pageLabel: routeLabel(safePath),
    generatedAt: new Date().toISOString(),
    taskSummary: {
      source: tasks.source,
      total: tasks.tasks.length,
      overdue: tasks.groups.overdue.length,
      today: tasks.groups.today.length,
      upcoming: tasks.groups.upcoming.length,
      scheduled: tasks.groups.scheduled.length,
      unscheduled: tasks.groups.unscheduled.length,
      highPriority: tasks.groups.highPriority.length,
      completedToday: completedTasks.completedCount,
    },
    automationSummary: {
      activeWorkflows: Number(overviewResult.data?.active_workflows ?? 0),
      healthyWorkflows: Number(overviewResult.data?.healthy_workflows ?? 0),
      warningWorkflows: Number(overviewResult.data?.warning_workflows ?? 0),
      criticalWorkflows: Number(overviewResult.data?.critical_workflows ?? 0),
      openIssues: Number(overviewResult.data?.open_issues ?? 0),
      executionsToday: Number(overviewResult.data?.executions_today ?? 0),
      errorsToday: Number(overviewResult.data?.errors_today ?? 0),
    },
    projectSummary: {
      total: projects.count,
      active: projects.active,
      source: projects.source,
    },
    connectionSummary: {
      total: connections.length,
      connected: connectedConnections,
      needsReview: connections.filter((connection) => connection.status !== "Connected").length,
      connectedNames: connections.filter((connection) => connection.status === "Connected").map((connection) => connection.name),
    },
    capabilitySummary: capabilitySummary(),
    recentActivity: (activityResult.data || []).map((item) => ({
      source: String(item.source_name || ""),
      status: String(item.status || ""),
      severity: String(item.severity || ""),
      summary: String(item.summary || "").slice(0, 180),
      occurredAt: String(item.occurred_at || ""),
    })),
    openIssues: (issuesResult.data || []).map((item) => ({
      source: String(item.source_workflow || ""),
      severity: String(item.severity || ""),
      urgency: String(item.urgency || ""),
      summary: String(item.summary || "").slice(0, 180),
      occurredAt: String(item.occurred_at || ""),
    })),
  };

  return context;
}

export type DashboardContext = Awaited<ReturnType<typeof buildDashboardContext>>;

export async function upsertDailyDashboardSnapshot({
  supabase,
  ownerId,
  context,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  context: DashboardContext;
}) {
  const memoryKey = centralDateKey();
  await supabase.from("jarvis_memory").upsert({
    owner_id: ownerId,
    scope: SNAPSHOT_SCOPE,
    memory_key: memoryKey,
    source: "ava-dashboard",
    confidence: 1,
    active: true,
    content: {
      memoryKey,
      generatedAt: context.generatedAt,
      path: context.path,
      pageLabel: context.pageLabel,
      taskSummary: context.taskSummary,
      automationSummary: context.automationSummary,
      projectSummary: context.projectSummary,
      connectionSummary: context.connectionSummary,
      capabilitySummary: context.capabilitySummary,
    },
  }, { onConflict: "owner_id,scope,memory_key" });
}

function trendLine(label: string, current: number, previous?: number) {
  if (previous == null) return `${label}: ${current}`;
  if (current === previous) return `${label}: stable at ${current}`;
  return `${label}: ${current > previous ? "up" : "down"} from ${previous} to ${current}`;
}

export async function buildTrendContext({
  supabase,
  ownerId,
}: {
  supabase: SupabaseClient;
  ownerId: string;
}) {
  const query = supabase
    .from("jarvis_memory")
    .select("memory_key,content,updated_at")
    .eq("owner_id", ownerId)
    .eq("scope", SNAPSHOT_SCOPE)
    .order("memory_key", { ascending: false })
    .limit(7) as QueryResult<Array<{ memory_key: string; content: Record<string, unknown>; updated_at: string }>>;
  const { data } = await query;
  const snapshots = data || [];
  const latest = snapshots[0]?.content as Record<string, unknown> | undefined;
  const previous = snapshots[1]?.content as Record<string, unknown> | undefined;
  const latestTasks = latest?.taskSummary as Record<string, number> | undefined;
  const previousTasks = previous?.taskSummary as Record<string, number> | undefined;
  const latestAutomations = latest?.automationSummary as Record<string, number> | undefined;
  const previousAutomations = previous?.automationSummary as Record<string, number> | undefined;

  return {
    snapshotCount: snapshots.length,
    latestMemoryKey: snapshots[0]?.memory_key || null,
    summary: snapshots.length
      ? [
        trendLine("Overdue tasks", latestTasks?.overdue ?? 0, previousTasks?.overdue),
        trendLine("Tasks due today", latestTasks?.today ?? 0, previousTasks?.today),
        trendLine("Open automation issues", latestAutomations?.openIssues ?? 0, previousAutomations?.openIssues),
        trendLine("Automation errors today", latestAutomations?.errorsToday ?? 0, previousAutomations?.errorsToday),
      ]
      : ["I do not have stored dashboard trend snapshots yet."],
  };
}

export type TrendContext = Awaited<ReturnType<typeof buildTrendContext>>;

export function summarizeDashboardContext(context: DashboardContext, trendContext: TrendContext) {
  const task = context.taskSummary;
  const automation = context.automationSummary;
  return [
    `You are looking at ${context.pageLabel}.`,
    `I see ${task.total} Todoist items: ${task.overdue} overdue, ${task.today} due today, ${task.upcoming} upcoming, and ${task.completedToday} completed today.`,
    `Automation status: ${automation.activeWorkflows} active workflows, ${automation.openIssues} open issues, ${automation.errorsToday} errors today.`,
    `Projects: ${context.projectSummary.active} active out of ${context.projectSummary.total}.`,
    `Connections: ${context.connectionSummary.connected} connected out of ${context.connectionSummary.total}.`,
    `Trend memory: ${trendContext.summary.join("; ")}.`,
  ].join(" ");
}
