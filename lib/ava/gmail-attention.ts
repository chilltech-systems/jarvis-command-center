import { callToolHub } from "@/lib/jarvis/tool-hub";

type GmailAccountId = "chill-tech" | "idad";
type GmailSeverity = "normal" | "warning" | "urgent";

type RawGmailMessage = {
  id?: string;
  threadId?: string;
  thread_id?: string;
  from?: unknown;
  sender?: string;
  subject?: unknown;
  snippet?: unknown;
  textSnippet?: string;
  bodyPreview?: string;
  receivedAt?: string;
  date?: string;
  internalDate?: string | number;
  labelIds?: unknown[];
  labels?: unknown[];
  unread?: boolean;
  headers?: Record<string, unknown>;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
  };
};

type GmailSearchResponse = {
  account?: string;
  messages?: RawGmailMessage[];
  items?: RawGmailMessage[];
  results?: RawGmailMessage[];
};

export type AvaGmailAttentionItem = {
  id: string;
  threadId: string;
  account: GmailAccountId;
  accountLabel: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  unread: boolean;
  severity: GmailSeverity;
  reason: string;
  action: string;
};

export type AvaGmailAttentionAccount = {
  account: GmailAccountId;
  label: string;
  attentionCount: number;
  unreadCount: number;
  urgentCount: number;
  items: AvaGmailAttentionItem[];
  error?: string | null;
};

const ATTENTION_QUERY = "in:inbox newer_than:7d -category:promotions -category:social";
const URGENT_PATTERN = /\b(urgent|asap|action required|approval|overdue|invoice|past due)\b/i;

const GMAIL_ACCOUNTS: Array<{ account: GmailAccountId; label: string }> = [
  { account: "chill-tech", label: "CHILL TECH" },
  { account: "idad", label: "IDAD" },
];

function textValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = value as { text?: unknown; html?: unknown; value?: Array<{ address?: unknown; name?: unknown }> };
    if (typeof candidate.text === "string") return candidate.text;
    const firstAddress = candidate.value?.find((entry) => entry.address || entry.name);
    if (firstAddress) {
      const address = typeof firstAddress.address === "string" ? firstAddress.address : "";
      const name = typeof firstAddress.name === "string" ? firstAddress.name : "";
      return name && address ? `${name} <${address}>` : name || address;
    }
    if (typeof candidate.html === "string") return candidate.html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }

  return "";
}

function extractHeader(message: RawGmailMessage, headerName: string) {
  const lower = headerName.toLowerCase();
  const fromObject = message.headers?.[headerName] || message.headers?.[lower];
  if (fromObject) return textValue(fromObject);

  return message.payload?.headers?.find((header) => header.name?.toLowerCase() === lower)?.value || "";
}

function extractMessages(data: unknown): RawGmailMessage[] | null {
  if (Array.isArray(data)) return data as RawGmailMessage[];
  if (!data || typeof data !== "object") return null;

  const candidate = data as GmailSearchResponse & { data?: unknown };
  if (Array.isArray(candidate.messages)) return candidate.messages;
  if (Array.isArray(candidate.items)) return candidate.items;
  if (Array.isArray(candidate.results)) return candidate.results;

  return extractMessages(candidate.data);
}

function toIsoDate(value: RawGmailMessage["internalDate"] | string | undefined) {
  if (!value) return new Date().toISOString();
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric).toISOString();
  const parsed = new Date(String(value));

  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function labelsFor(message: RawGmailMessage) {
  return [...(message.labelIds || []), ...(message.labels || [])]
    .map((label) => {
      if (typeof label === "string") return label;
      if (label && typeof label === "object") {
        const candidate = label as { id?: unknown; name?: unknown };
        return String(candidate.id || candidate.name || "");
      }

      return "";
    })
    .filter(Boolean)
    .map((label) => label.toUpperCase());
}

function severityFor(message: RawGmailMessage, subject: string, snippet: string, unread: boolean): { severity: GmailSeverity; reason: string } {
  const labels = labelsFor(message);
  if (URGENT_PATTERN.test(`${subject} ${snippet}`)) {
    return { severity: "urgent", reason: "Urgent keyword match" };
  }
  if (unread) return { severity: "warning", reason: "Unread inbox item" };
  if (labels.includes("IMPORTANT") || labels.includes("STARRED")) {
    return { severity: "warning", reason: "Marked important or starred" };
  }

  return { severity: "normal", reason: "Recent inbox item" };
}

function normalizeMessage(message: RawGmailMessage, account: GmailAccountId, accountLabel: string): AvaGmailAttentionItem {
  const labels = labelsFor(message);
  const subject = textValue(message.subject) || extractHeader(message, "Subject") || "(No subject)";
  const snippet = textValue(message.snippet) || message.textSnippet || message.bodyPreview || "";
  const unread = message.unread === true || labels.includes("UNREAD");
  const { severity, reason } = severityFor(message, subject, snippet, unread);

  return {
    id: message.id || crypto.randomUUID(),
    threadId: message.threadId || message.thread_id || message.id || crypto.randomUUID(),
    account,
    accountLabel,
    from: textValue(message.from) || message.sender || extractHeader(message, "From") || "Unknown sender",
    subject,
    snippet,
    receivedAt: toIsoDate(message.internalDate || message.receivedAt || message.date),
    unread,
    severity,
    reason,
    action: "Review Email",
  };
}

function summaryFor(accounts: AvaGmailAttentionAccount[]) {
  const attentionCount = accounts.reduce((sum, account) => sum + account.attentionCount, 0);
  const unreadCount = accounts.reduce((sum, account) => sum + account.unreadCount, 0);
  const urgentCount = accounts.reduce((sum, account) => sum + account.urgentCount, 0);

  if (!attentionCount) return "I did not find priority Gmail items in the current scan.";

  const accountBreakdown = accounts
    .filter((account) => account.attentionCount > 0)
    .map((account) => `${account.label}: ${account.attentionCount}`)
    .join(", ");

  return `I found ${attentionCount} Gmail item${attentionCount === 1 ? "" : "s"} across ${accountBreakdown}. ${unreadCount} unread, ${urgentCount} urgent.`;
}

async function readAccount(account: GmailAccountId, label: string): Promise<AvaGmailAttentionAccount> {
  const response = await callToolHub<GmailSearchResponse>({
    tool: "gmail.search",
    parameters: {
      account,
      query: ATTENTION_QUERY,
      limit: 25,
    },
    user: "cody",
    timeoutMs: 3000,
  });

  const messages = response.success ? extractMessages(response.data) : null;
  if (!messages) {
    return {
      account,
      label,
      attentionCount: 0,
      unreadCount: 0,
      urgentCount: 0,
      items: [],
      error: response.error || "Unexpected Gmail response format",
    };
  }

  const items = messages.map((message) => normalizeMessage(message, account, label));

  return {
    account,
    label,
    attentionCount: items.length,
    unreadCount: items.filter((item) => item.unread).length,
    urgentCount: items.filter((item) => item.severity === "urgent").length,
    items,
    error: null,
  };
}

export async function getAvaGmailAttention() {
  const accounts = await Promise.all(
    GMAIL_ACCOUNTS.map(({ account, label }) => readAccount(account, label)),
  );
  const attentionCount = accounts.reduce((sum, account) => sum + account.attentionCount, 0);
  const unreadCount = accounts.reduce((sum, account) => sum + account.unreadCount, 0);
  const urgentCount = accounts.reduce((sum, account) => sum + account.urgentCount, 0);
  const failedAccounts = accounts.filter((account) => account.error);
  const successfulAccounts = accounts.length - failedAccounts.length;

  return {
    source: successfulAccounts ? "live-gmail" : "unavailable",
    accounts,
    attentionCount,
    unreadCount,
    urgentCount,
    summary: summaryFor(accounts),
    error: failedAccounts.length === accounts.length
      ? failedAccounts.map((account) => `${account.label}: ${account.error}`).join("; ")
      : null,
  };
}
