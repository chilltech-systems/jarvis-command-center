import { callToolHub } from "@/lib/jarvis/tool-hub";
import { getCentralDayWindow } from "@/lib/ava/time";

export type AvaCompletedTask = {
  id: string;
  title: string;
  completedAt: string;
  project?: string;
  source: "Todoist";
};

type TodoistCompletedTask = {
  id?: string;
  object_id?: string;
  task_id?: string;
  content?: string;
  task_content?: string;
  object_content?: string;
  extra_data?: {
    content?: string;
    task_content?: string;
    item_content?: string;
    item_name?: string;
    project_name?: string;
  };
  event_data?: {
    content?: string;
    task_content?: string;
    item_content?: string;
    item_name?: string;
    project_name?: string;
  };
  completed_at?: string;
  project_id?: string;
  project_name?: string;
  checked?: boolean;
  event_date?: string;
  event_type?: string;
  object_type?: string;
};

type TodoistCompletedResponse = {
  items?: TodoistCompletedTask[];
  tasks?: TodoistCompletedTask[];
  results?: TodoistCompletedTask[];
};

async function fetchTodoistCompletedActivity({ since, until }: { since: string; until: string }) {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token) return { completed: null, error: "TODOIST_API_TOKEN is not configured." };

  const params = new URLSearchParams({
    object_event_types: JSON.stringify(["item:completed"]),
    date_from: since,
    date_to: until,
    limit: "100",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  let response: Response;
  try {
    response = await fetch(`https://api.todoist.com/api/v1/activities?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    return {
      completed: null,
      error: error instanceof Error && error.name === "AbortError" ? "Todoist completed-task read timed out." : "Todoist completed-task read failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      completed: null,
      error: typeof data?.message === "string" ? data.message : `Todoist activities returned HTTP ${response.status}.`,
    };
  }

  return {
    completed: extractCompletedTasks(data),
    error: null,
  };
}

function extractCompletedTasks(data: unknown): TodoistCompletedTask[] | null {
  if (Array.isArray(data)) return data as TodoistCompletedTask[];
  if (!data || typeof data !== "object") return null;

  const candidate = data as TodoistCompletedResponse;
  if (Array.isArray(candidate.items)) return candidate.items;
  if (Array.isArray(candidate.tasks)) return candidate.tasks;
  if (Array.isArray(candidate.results)) return candidate.results;

  return null;
}

function mapCompletedTask(task: TodoistCompletedTask): AvaCompletedTask {
  return {
    id: task.object_id || task.task_id || task.id || crypto.randomUUID(),
    title: task.task_content
      || task.object_content
      || task.extra_data?.task_content
      || task.extra_data?.item_content
      || task.extra_data?.item_name
      || task.extra_data?.content
      || task.event_data?.task_content
      || task.event_data?.item_content
      || task.event_data?.item_name
      || task.event_data?.content
      || task.content
      || "Untitled completed Todoist task",
    completedAt: task.completed_at || task.event_date || new Date().toISOString(),
    project: task.project_name || task.extra_data?.project_name || task.event_data?.project_name || task.project_id,
    source: "Todoist",
  };
}

function hasCompletionEvidence(task: TodoistCompletedTask) {
  return Boolean(
    task.completed_at
    || task.event_date
    || task.checked === true
    || task.event_type === "completed"
  );
}

function parseCompletedTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function compareCompletedTasksByDate(first: AvaCompletedTask, second: AvaCompletedTask) {
  const timeDifference = parseCompletedTime(first.completedAt) - parseCompletedTime(second.completedAt);
  if (timeDifference) return timeDifference;

  const titleDifference = first.title.localeCompare(second.title);
  if (titleDifference) return titleDifference;

  return first.id.localeCompare(second.id);
}

function sortCompletedTasksByDate(tasks: AvaCompletedTask[]) {
  return [...tasks].sort(compareCompletedTasksByDate);
}

function completedSummary(tasks: AvaCompletedTask[]) {
  if (!tasks.length) return "I have not seen completed Todoist tasks yet today.";
  const titles = tasks.slice(0, 3).map((task) => task.title).join(", ");
  const suffix = tasks.length > 3 ? `, and ${tasks.length - 3} more` : "";

  return `I saw ${tasks.length} Todoist task${tasks.length === 1 ? "" : "s"} completed today, including ${titles}${suffix}.`;
}

export async function getAvaCompletedTasks() {
  const { since, until } = getCentralDayWindow();
  const direct = await fetchTodoistCompletedActivity({ since, until });
  if (direct.completed) {
    const completedToday = sortCompletedTasksByDate(direct.completed.filter(hasCompletionEvidence).map(mapCompletedTask));

    return {
      source: "live-todoist-api",
      completedCount: completedToday.length,
      completedToday,
      completedSummary: completedSummary(completedToday),
      error: null,
    };
  }
  const response = await callToolHub<TodoistCompletedResponse>({
    tool: "todoist.completed",
    parameters: { since, until, limit: 100 },
    user: "cody",
    timeoutMs: 3000,
  });
  const completed = response.success ? extractCompletedTasks(response.data) : null;
  const completedToday = completed ? sortCompletedTasksByDate(completed.filter(hasCompletionEvidence).map(mapCompletedTask)) : [];

  return {
    source: completed ? "live-todoist" : "unavailable",
    completedCount: completedToday.length,
    completedToday,
    completedSummary: completedSummary(completedToday),
    error: completed ? null : direct.error || response.error || "Unexpected Todoist completed-task response format",
  };
}
