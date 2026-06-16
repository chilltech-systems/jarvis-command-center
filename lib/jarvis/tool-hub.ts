type ToolHubRequest = {
  tool: string;
  parameters?: Record<string, unknown>;
  user?: string;
};

export type TodoistTask = {
  id?: string;
  content?: string;
  due?: {
    string?: string;
    date?: string;
  } | null;
  priority?: number;
};

type ToolHubResponse<T = unknown> = {
  success: boolean;
  tool: string;
  timestamp?: string;
  data?: T;
  error?: string;
};

export function toolHubConfigured() {
  return Boolean(process.env.JARVIS_TOOL_HUB_URL && process.env.JARVIS_TOOL_HUB_TOKEN);
}

export async function callToolHub<T = unknown>({ tool, parameters = {}, user = "cody" }: ToolHubRequest): Promise<ToolHubResponse<T>> {
  const url = process.env.JARVIS_TOOL_HUB_URL;
  const token = process.env.JARVIS_TOOL_HUB_TOKEN;
  if (!url || !token) {
    return {
      success: false,
      tool,
      error: "Jarvis Tool Hub is not configured.",
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-JARVIS-TOKEN": token,
    },
    body: JSON.stringify({
      tool,
      parameters,
      user,
      source: "jarvis-command-center",
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      success: false,
      tool,
      error: typeof data.error === "string" ? data.error : `Tool Hub returned HTTP ${response.status}.`,
    };
  }

  return data as ToolHubResponse<T>;
}

export function formatTodoistTasks(tasks: TodoistTask[]) {
  if (!tasks.length) return "Todoist is connected. I did not find any tasks matching today or overdue.";

  const lines = tasks.slice(0, 8).map((task, index) => {
    const due = task.due?.string || task.due?.date;
    return `${index + 1}. ${task.content || "Untitled task"}${due ? ` (${due})` : ""}`;
  });
  const suffix = tasks.length > lines.length ? `\n\n${tasks.length - lines.length} more tasks are available in Todoist.` : "";
  return `Todoist tasks for today/overdue:\n${lines.join("\n")}${suffix}`;
}
