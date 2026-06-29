import fs from "node:fs";

type ToolHubRequest = {
  tool: string;
  parameters?: Record<string, unknown>;
  user?: string;
};

export type TodoistTask = {
  id?: string;
  content?: string;
  url?: string;
  due?: {
    string?: string;
    date?: string;
    datetime?: string;
  } | null;
  priority?: number;
};

export type TodoistCreateParameters = {
  task: string;
  due?: string;
  description?: string;
  priority?: number;
};

type ToolHubResponse<T = unknown> = {
  success: boolean;
  tool: string;
  timestamp?: string;
  data?: T;
  error?: string;
};

function parseEnvFile(path: string) {
  try {
    const env: Record<string, string> = {};
    for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

function toolHubSettings() {
  const n8nEnv = parseEnvFile("/Users/c.hill/Documents/Projects/.secrets/n8n.env");
  const tokenEnv = parseEnvFile("/Users/c.hill/Documents/Projects/.secrets/jarvis-tool-hub.env");
  const baseUrl = n8nEnv.N8N_BASE_URL?.replace(/\/api\/v1\/?$/, "");
  return {
    url: process.env.JARVIS_TOOL_HUB_URL || (baseUrl ? `${baseUrl}/webhook/jarvis-tools` : ""),
    token: process.env.JARVIS_TOOL_HUB_TOKEN || tokenEnv.JARVIS_TOKEN || "",
  };
}

export function toolHubConfigured() {
  const { url, token } = toolHubSettings();
  return Boolean(url && token);
}

export async function callToolHub<T = unknown>({ tool, parameters = {}, user = "cody" }: ToolHubRequest): Promise<ToolHubResponse<T>> {
  const { url, token } = toolHubSettings();
  if (!url || !token) {
    return {
      success: false,
      tool,
      error: "Ava Tool Hub is not configured.",
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

export function extractTodoistTasks(data: unknown): TodoistTask[] | null {
  if (Array.isArray(data)) return data as TodoistTask[];
  if (!data || typeof data !== "object") return null;

  const maybeResults = (data as { results?: unknown }).results;
  if (Array.isArray(maybeResults)) return maybeResults as TodoistTask[];

  const maybeTasks = (data as { tasks?: unknown }).tasks;
  if (Array.isArray(maybeTasks)) return maybeTasks as TodoistTask[];

  return null;
}

export function parseTodoistCreateRequest(message: string): TodoistCreateParameters | null {
  const normalized = message
    .trim()
    .replace(/^(jarvis[, ]*)?/i, "")
    .replace(/^(please\s+)?(can you|could you|would you)\s+/i, "")
    .trim();

  const extractedTask = [
    /\b(?:create|add|make|new)\s+(?:a\s+)?(?:todoist\s+)?(?:task|todo|to do)\s+(?:to\s+)?(.+?)(?:\s+(?:to|in|on)\s+(?:my\s+)?(?:todoist|todo|to do|task)\s*(?:list)?\s*)?$/i,
    /\b(?:create|add|make|new|put)\s+(.+?)\s+(?:to|in|on)\s+(?:my\s+)?(?:todoist|todo|to do|task)\s*(?:list)?\s*$/i,
    /^remind me to\s+(.+)$/i,
  ].map((pattern) => normalized.match(pattern)?.[1]?.trim()).find(Boolean);

  const cleaned = (extractedTask || normalized)
    .trim()
    .replace(/^(please\s+)?(create|add|make|new)\s+(a\s+)?(todoist\s+)?(task|todo|to do)(\s+to)?\s*/i, "")
    .replace(/^(please\s+)?(create|add|make|new)\s+/i, "")
    .replace(/^remind me to\s+/i, "")
    .replace(/\s+(to|in|on)\s+(my\s+)?(todoist|todo|to do|task)\s*(list)?\s*$/i, "")
    .replace(/^[:\-]\s*/, "")
    .trim();

  if (!cleaned) return null;

  let task = cleaned;
  let due: string | undefined;
  const dueMatch = task.match(/\b(?:due|for|on)\s+(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (dueMatch) {
    due = dueMatch[1].toLowerCase();
    task = task.replace(dueMatch[0], "").replace(/\s+/g, " ").trim();
  }

  return {
    task: task || cleaned,
    ...(due ? { due } : {}),
  };
}

export function formatTodoistCreateResult(data: unknown) {
  if (!data || typeof data !== "object") return "Todoist task created.";
  const candidate = (data as { result?: unknown; task?: unknown; data?: unknown }).result
    ?? (data as { task?: unknown }).task
    ?? data;
  if (!candidate || typeof candidate !== "object") return "Todoist task created.";
  const content = (candidate as { content?: unknown }).content;
  return typeof content === "string" && content.trim()
    ? `Todoist task created: ${content.trim()}`
    : "Todoist task created.";
}
