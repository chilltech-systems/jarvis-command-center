import fs from "node:fs";

type ToolHubRequest = {
  tool: string;
  parameters?: Record<string, unknown>;
  user?: string;
  timeoutMs?: number;
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

type CredentialCatalog = {
  defaults?: Record<string, string>;
  accounts?: Record<string, Record<string, { status?: string; credentialName?: string; credentialType?: string }>>;
};

type ToolRegistry = {
  tools?: Record<string, { enabled?: boolean; permission?: string; workflow?: string; webhookPath?: string }>;
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

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function getToolHubCredentialCatalog() {
  return readJson<CredentialCatalog>("/Users/c.hill/Documents/Projects/jarvis-tool-hub/schemas/credential-routing-catalog.json", {});
}

export function getToolHubRegistry() {
  return readJson<ToolRegistry>("/Users/c.hill/Documents/Projects/jarvis-tool-hub/schemas/tool-registry.json", {});
}

export function connectedToolHubAccounts(service: string) {
  const catalog = getToolHubCredentialCatalog();
  return Object.entries(catalog.accounts?.[service] || {})
    .filter(([, account]) => account.status === "connected")
    .map(([key, account]) => ({
      key,
      credentialName: account.credentialName || key,
      credentialType: account.credentialType || "",
    }));
}

export function toolHubToolEnabled(tool: string) {
  return getToolHubRegistry().tools?.[tool]?.enabled === true;
}

export function toolHubServiceConnected(service: string) {
  return toolHubConfigured() && connectedToolHubAccounts(service).length > 0;
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

export async function callToolHub<T = unknown>({ tool, parameters = {}, user = "cody", timeoutMs = 8000 }: ToolHubRequest): Promise<ToolHubResponse<T>> {
  const { url, token } = toolHubSettings();
  if (!url || !token) {
    return {
      success: false,
      tool,
      error: "Ava Tool Hub is not configured.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
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
      signal: controller.signal,
    });
  } catch (error) {
    return {
      success: false,
      tool,
      error: error instanceof Error && error.name === "AbortError" ? `Tool Hub timed out after ${timeoutMs}ms.` : "Tool Hub request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
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
  const suffix = tasks.length > lines.length ? `\n\nI found ${tasks.length - lines.length} more task${tasks.length - lines.length === 1 ? "" : "s"} available in Todoist.` : "";
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

export type GmailMessageSummary = {
  id?: string;
  threadId?: string;
  from?: unknown;
  sender?: string;
  subject?: unknown;
  snippet?: unknown;
  textSnippet?: string;
  bodyPreview?: string;
  internalDate?: string | number;
  date?: string;
};

function textValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = value as { text?: unknown; value?: Array<{ address?: unknown; name?: unknown }> };
    if (typeof candidate.text === "string") return candidate.text;
    const first = candidate.value?.find((entry) => entry.address || entry.name);
    if (first) return [first.name, first.address].filter(Boolean).join(" ");
  }
  return "";
}

export function extractArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;
  const candidate = data as { messages?: unknown; items?: unknown; results?: unknown; events?: unknown; rows?: unknown; values?: unknown; data?: unknown };
  for (const value of [candidate.messages, candidate.items, candidate.results, candidate.events, candidate.rows, candidate.values]) {
    if (Array.isArray(value)) return value;
  }
  return extractArray(candidate.data);
}

export function formatGmailSearchResult(data: unknown) {
  const messages = extractArray(data) as GmailMessageSummary[] | null;
  if (!messages?.length) return "I searched Gmail and did not find matching messages.";

  const lines = messages.slice(0, 6).map((message, index) => {
    const from = textValue(message.from) || message.sender || "Unknown sender";
    const subject = textValue(message.subject) || "(No subject)";
    const snippet = textValue(message.snippet) || message.textSnippet || message.bodyPreview || "";
    return `${index + 1}. ${subject} — ${from}${snippet ? `: ${snippet.slice(0, 120)}` : ""}`;
  });
  const suffix = messages.length > lines.length ? `\n\nI found ${messages.length - lines.length} more matching message${messages.length - lines.length === 1 ? "" : "s"}.` : "";
  return `I found ${messages.length} Gmail message${messages.length === 1 ? "" : "s"}:\n${lines.join("\n")}${suffix}`;
}

export function formatCalendarListResult(data: unknown) {
  const events = extractArray(data);
  if (!events?.length) return "I checked calendar and did not find upcoming events in the returned window.";

  const lines = events.slice(0, 8).map((event, index) => {
    const item = event as { summary?: unknown; title?: unknown; start?: unknown; end?: unknown };
    const title = textValue(item.summary) || textValue(item.title) || "Untitled event";
    const start = typeof item.start === "string" ? item.start : item.start && typeof item.start === "object" ? textValue((item.start as { dateTime?: unknown; date?: unknown }).dateTime || (item.start as { date?: unknown }).date) : "";
    return `${index + 1}. ${title}${start ? ` (${start})` : ""}`;
  });
  const suffix = events.length > lines.length ? `\n\nI found ${events.length - lines.length} more event${events.length - lines.length === 1 ? "" : "s"}.` : "";
  return `I found ${events.length} calendar event${events.length === 1 ? "" : "s"}:\n${lines.join("\n")}${suffix}`;
}

export function formatSheetReadResult(data: unknown) {
  const rows = extractArray(data);
  if (!rows?.length) return "I read the sheet and did not find returned rows.";
  return `I read ${rows.length} sheet row${rows.length === 1 ? "" : "s"}. I kept the raw values out of this summary so the dashboard stays clean.`;
}
