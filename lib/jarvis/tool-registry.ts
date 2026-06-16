import type { JarvisToolDefinition } from "@/lib/jarvis/types";

export const JARVIS_TOOLS: JarvisToolDefinition[] = [
  { name: "get_n8n_status", description: "Summarize n8n workflow health, executions, and open issues.", category: "Automation", permission: "read_only", status: "available", integration: "n8n" },
  { name: "run_n8n_workflow", description: "Trigger an approved n8n workflow.", category: "Automation", permission: "requires_approval", status: "planned", integration: "n8n", approvalAction: "Run workflow" },
  { name: "todoist.list", description: "List Todoist tasks for today and overdue work.", category: "Tasks", permission: "read_only", status: "available", integration: "todoist" },
  { name: "todoist.create", description: "Create an approved Todoist task.", category: "Tasks", permission: "requires_approval", status: "available", integration: "todoist", approvalAction: "Create Todoist task" },
  { name: "todoist.complete", description: "Complete an approved Todoist task.", category: "Tasks", permission: "requires_approval", status: "available", integration: "todoist", approvalAction: "Complete Todoist task" },
  { name: "get_recent_emails", description: "Read and summarize recent Gmail messages.", category: "Communication", permission: "read_only", status: "credential_needed", integration: "gmail" },
  { name: "draft_email", description: "Prepare an email draft without sending it.", category: "Communication", permission: "draft", status: "credential_needed", integration: "gmail" },
  { name: "get_calendar_events", description: "Read upcoming Google Calendar events.", category: "Scheduling", permission: "read_only", status: "credential_needed", integration: "google_calendar" },
  { name: "draft_calendar_event", description: "Prepare a calendar event for approval.", category: "Scheduling", permission: "draft", status: "credential_needed", integration: "google_calendar" },
  { name: "get_business_metrics", description: "Answer questions from connected operating metrics.", category: "Business Intelligence", permission: "read_only", status: "planned", integration: "business_data" },
  { name: "search_project_knowledge", description: "Search approved project documentation and architecture notes.", category: "Knowledge", permission: "read_only", status: "planned", integration: "project_knowledge" },
  { name: "create_codex_task", description: "Queue an approved Codex prompt for the local runner.", category: "Development", permission: "requires_approval", status: "available", integration: "codex", approvalAction: "Queue Codex prompt" },
  { name: "send_slack_message", description: "Send an approved Slack message.", category: "Communication", permission: "requires_approval", status: "credential_needed", integration: "slack", approvalAction: "Send Slack message" },
];

export function findToolForMessage(message: string) {
  const normalized = message.toLowerCase();
  const toolByName = (name: string) => JARVIS_TOOLS.find((tool) => tool.name === name);

  if (/(run|trigger|start).*(workflow|automation)/.test(normalized)) return toolByName("run_n8n_workflow");
  if (/(todoist|to do|todo|task|tasks|what do i need to do today|what are my tasks)/.test(normalized)) {
    if (/(create|add|new)\b/.test(normalized) && /(todoist|task|todo|to do)/.test(normalized)) return toolByName("todoist.create");
    if (/(complete|finish|done|close)\b/.test(normalized) && /(todoist|task|todo|to do)/.test(normalized)) return toolByName("todoist.complete");
    return toolByName("todoist.list");
  }
  if (/(failed|failure|n8n|automation|workflow|system status|needs my attention)/.test(normalized)) return toolByName("get_n8n_status");
  if (/(email|inbox|gmail)/.test(normalized)) return normalized.includes("draft") || normalized.includes("reply") ? toolByName("draft_email") : toolByName("get_recent_emails");
  if (/(calendar|schedule|meeting|appointment)/.test(normalized)) return normalized.includes("create") || normalized.includes("draft") ? toolByName("draft_calendar_event") : toolByName("get_calendar_events");
  if (/(sales|labor|catering|metric|report)/.test(normalized)) return toolByName("get_business_metrics");
  if (/(how does|explain|documentation|knowledge|where does)/.test(normalized)) return toolByName("search_project_knowledge");
  if (/(codex|code|repository|github|development task)/.test(normalized)) return toolByName("create_codex_task");
  if (/(slack|message)/.test(normalized)) return toolByName("send_slack_message");

  return undefined;
}
