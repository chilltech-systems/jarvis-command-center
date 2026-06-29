export type AvaConnectorSnapshot = {
  id: string;
  name: string;
  category: string;
  status: "Connected" | "Available" | "Needs Review";
  source: string;
  updatedAt: string;
  summary: string;
  metrics?: Record<string, string | number>;
};

export const connectorSnapshots: AvaConnectorSnapshot[] = [
  {
    id: "codex-gmail",
    name: "Gmail",
    category: "Communication",
    status: "Connected",
    source: "Codex Gmail connector",
    updatedAt: "2026-06-28T20:12:43Z",
    summary: "Read-only mailbox access confirmed for Cody Hill.",
    metrics: {
      inboxUnread: 66,
      unreadThreads: 43,
      inboxMessages: 12014,
    },
  },
  {
    id: "codex-google-drive",
    name: "Google Drive",
    category: "Files and docs",
    status: "Connected",
    source: "Codex Google Drive connector",
    updatedAt: "2026-06-28T20:12:43Z",
    summary: "Drive connector responded successfully. No shared drives were returned.",
    metrics: {
      sharedDrives: 0,
    },
  },
  {
    id: "codex-slack",
    name: "Slack",
    category: "Communication",
    status: "Connected",
    source: "Codex Slack connector",
    updatedAt: "2026-06-28T20:12:43Z",
    summary: "Slack connector returned visible public, private, and direct-message conversations.",
    metrics: {
      sampledConversations: 3,
      hasMore: "yes",
    },
  },
];

export function getConnectorSnapshots() {
  return connectorSnapshots;
}
