import type { JarvisToolDefinition } from "@/lib/jarvis/types";

export const JARVIS_TOOLS: JarvisToolDefinition[] = [
  { name: "get_n8n_status", description: "Summarize n8n workflow health, executions, and open issues.", category: "Automation", permission: "read_only", status: "available", integration: "n8n" },
  { name: "run_n8n_workflow", description: "Trigger an approved n8n workflow.", category: "Automation", permission: "requires_approval", status: "planned", integration: "n8n", approvalAction: "Run workflow" },
  { name: "get_recent_emails", description: "Read and summarize recent Gmail messages.", category: "Communication", permission: "read_only", status: "credential_needed", integration: "gmail" },
  { name: "draft_email", description: "Prepare an email draft without sending it.", category: "Communication", permission: "draft", status: "credential_needed", integration: "gmail" },
  { name: "get_calendar_events", description: "Read upcoming Google Calendar events.", category: "Scheduling", permission: "read_only", status: "credential_needed", integration: "google_calendar" },
  { name: "draft_calendar_event", description: "Prepare a calendar event for approval.", category: "Scheduling", permission: "draft", status: "credential_needed", integration: "google_calendar" },
  { name: "get_business_metrics", description: "Answer questions from connected operating metrics.", category: "Business Intelligence", permission: "read_only", status: "planned", integration: "business_data" },
  { name: "search_project_knowledge", description: "Search approved project documentation and architecture notes.", category: "Knowledge", permission: "read_only", status: "planned", integration: "project_knowledge" },
  { name: "create_codex_task", description: "Prepare a scoped development task for Codex.", category: "Development", permission: "draft", status: "planned", integration: "codex" },
  { name: "send_slack_message", description: "Send an approved Slack message.", category: "Communication", permission: "requires_approval", status: "credential_needed", integration: "slack", approvalAction: "Send Slack message" },
];

export function findToolForMessage(message: string) {
  const normalized = message.toLowerCase();

  if (/(run|trigger|start).*(workflow|automation)/.test(normalized)) return JARVIS_TOOLS[1];
  if (/(failed|failure|n8n|automation|workflow|system status|needs my attention)/.test(normalized)) return JARVIS_TOOLS[0];
  if (/(email|inbox|gmail)/.test(normalized)) return normalized.includes("draft") || normalized.includes("reply") ? JARVIS_TOOLS[3] : JARVIS_TOOLS[2];
  if (/(calendar|schedule|meeting|appointment)/.test(normalized)) return normalized.includes("create") || normalized.includes("draft") ? JARVIS_TOOLS[5] : JARVIS_TOOLS[4];
  if (/(sales|labor|catering|metric|report)/.test(normalized)) return JARVIS_TOOLS[6];
  if (/(how does|explain|documentation|knowledge|where does)/.test(normalized)) return JARVIS_TOOLS[7];
  if (/(codex|code|repository|github|development task)/.test(normalized)) return JARVIS_TOOLS[8];
  if (/(slack|message)/.test(normalized)) return JARVIS_TOOLS[9];

  return undefined;
}
