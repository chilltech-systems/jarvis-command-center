import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvaDailyContext } from "@/lib/ava/daily-context";
import type { AvaCapabilityDefinition, AvaRealtimeTool, AvaToolResult } from "@/lib/ava/gateway/types";
import { createCodexPromptPackage, codexApprovalTarget } from "@/lib/jarvis/codex";
import {
  callToolHub,
  extractTodoistTasks,
  formatCalendarListResult,
  formatGmailSearchResult,
  formatTodoistTasks,
} from "@/lib/jarvis/tool-hub";
import { getAvaRuntime } from "@/lib/ava/runtime";

const emptyObject = { type: "object", properties: {}, additionalProperties: false } as const;

export const AVA_CAPABILITIES: AvaCapabilityDefinition[] = [
  { name: "ava_context_current", description: "Get Ava's compact current mission, focus, summaries, risks, and freshness.", category: "Context", permission: "read_only", status: "available", integration: "ava_core", parameters: emptyObject },
  { name: "ava_context_changes", description: "Get meaningful recent changes and why they matter.", category: "Context", permission: "read_only", status: "available", integration: "ava_core", parameters: emptyObject },
  { name: "ava_memory_recall", description: "Recall relevant active Ava memories with provenance and confidence.", category: "Memory", permission: "read_only", status: "available", integration: "ava_core", parameters: { type: "object", properties: { query: { type: "string", description: "Words or entity names to recall." }, kind: { type: "string", description: "Optional memory kind.", enum: ["working", "episode", "fact", "procedure", "commitment", "preference", "feedback", "entity", "relationship"] } }, required: ["query"], additionalProperties: false } },
  { name: "ava_world_lookup", description: "Look up people, projects, systems, devices, places, and relationships in Ava's world model.", category: "World Model", permission: "read_only", status: "available", integration: "ava_core", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { name: "ava_reasoning_evidence", description: "Explain Ava's current priorities, risks, attention scores, and recommendations from available evidence.", category: "Reasoning", permission: "read_only", status: "available", integration: "ava_core", parameters: { type: "object", properties: { topic: { type: "string" } }, additionalProperties: false } },
  { name: "ava_source_health", description: "Report connected-source freshness, failures, and fallback state.", category: "Context", permission: "read_only", status: "available", integration: "ava_core", parameters: emptyObject },
  { name: "ava_approvals_pending", description: "List pending Ava actions awaiting explicit approval.", category: "Approvals", permission: "read_only", status: "available", integration: "ava_core", parameters: emptyObject },
  { name: "ava_approval_resolve", description: "Approve or deny one exact pending Ava action after the user gives an explicit voice or text confirmation.", category: "Approvals", permission: "execute", status: "available", integration: "ava_core", parameters: { type: "object", properties: { approval_id: { type: "string" }, decision: { type: "string", enum: ["approved", "denied"] }, confirmation_text: { type: "string", description: "The user's exact confirming words." }, modality: { type: "string", enum: ["voice", "text"] } }, required: ["approval_id", "decision", "confirmation_text", "modality"], additionalProperties: false } },
  { name: "ava_runtime_status", description: "Get Ava runtime lifecycle, health, scheduler, memory, and cognition status.", category: "Runtime", permission: "read_only", status: "available", integration: "ava_runtime", parameters: emptyObject },
  { name: "ava_perception_current", description: "Get read-only perception adapter health and the latest observation, including Home Assistant when connected.", category: "Perception", permission: "read_only", status: "available", integration: "home_assistant", parameters: emptyObject },
  { name: "get_n8n_status", description: "Summarize n8n workflow health, executions, errors, and open issues.", category: "Automation", permission: "read_only", status: "available", integration: "n8n", parameters: emptyObject },
  { name: "todoist_list", description: "List Todoist tasks matching a filter.", category: "Tasks", permission: "read_only", status: "available", integration: "todoist", toolHubTool: "todoist.list", parameters: { type: "object", properties: { filter: { type: "string", description: "Todoist filter; defaults to today or overdue." } }, additionalProperties: false } },
  { name: "todoist_create", description: "Prepare a Todoist task for explicit approval.", category: "Tasks", permission: "requires_approval", status: "available", integration: "todoist", approvalAction: "Create Todoist task", toolHubTool: "todoist.create", parameters: { type: "object", properties: { task: { type: "string" }, due: { type: "string" }, description: { type: "string" }, priority: { type: "number" } }, required: ["task"], additionalProperties: false } },
  { name: "todoist_complete", description: "Prepare completion of a Todoist task for explicit approval.", category: "Tasks", permission: "requires_approval", status: "available", integration: "todoist", approvalAction: "Complete Todoist task", toolHubTool: "todoist.complete", parameters: { type: "object", properties: { task_id: { type: "string" }, task_name: { type: "string" } }, required: ["task_id"], additionalProperties: false } },
  { name: "gmail_search", description: "Search and summarize connected Gmail messages.", category: "Communication", permission: "read_only", status: "available", integration: "gmail", toolHubTool: "gmail.search", parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"], additionalProperties: false } },
  { name: "email_draft", description: "Prepare email copy without sending it.", category: "Communication", permission: "draft", status: "available", integration: "gmail", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"], additionalProperties: false } },
  { name: "email_send", description: "Prepare a Gmail message for explicit approval and sending.", category: "Communication", permission: "requires_approval", status: "available", integration: "gmail", approvalAction: "Send Gmail message", toolHubTool: "gmail.send", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"], additionalProperties: false } },
  { name: "calendar_list", description: "List connected Google Calendar events.", category: "Scheduling", permission: "read_only", status: "available", integration: "google_calendar", toolHubTool: "calendar.list", parameters: { type: "object", properties: { start: { type: "string" }, end: { type: "string" } }, additionalProperties: false } },
  { name: "calendar_draft", description: "Prepare calendar event details without creating it.", category: "Scheduling", permission: "draft", status: "available", integration: "google_calendar", parameters: { type: "object", properties: { title: { type: "string" }, start: { type: "string" }, end: { type: "string" }, notes: { type: "string" } }, required: ["title", "start", "end"], additionalProperties: false } },
  { name: "calendar_create", description: "Prepare a calendar event for explicit approval and creation.", category: "Scheduling", permission: "requires_approval", status: "available", integration: "google_calendar", approvalAction: "Create calendar event", toolHubTool: "calendar.create", parameters: { type: "object", properties: { title: { type: "string" }, start: { type: "string" }, end: { type: "string" }, notes: { type: "string" } }, required: ["title", "start", "end"], additionalProperties: false } },
  { name: "sheets_read", description: "Read a Google Sheet range.", category: "Business Intelligence", permission: "read_only", status: "available", integration: "business_data", toolHubTool: "sheets.read", parameters: { type: "object", properties: { sheetId: { type: "string" }, range: { type: "string" } }, required: ["sheetId", "range"], additionalProperties: false } },
  { name: "sheets_write", description: "Prepare a Google Sheet write for explicit approval.", category: "Business Intelligence", permission: "requires_approval", status: "available", integration: "business_data", approvalAction: "Write Google Sheet range", toolHubTool: "sheets.write", parameters: { type: "object", properties: { sheetId: { type: "string" }, range: { type: "string" }, values_json: { type: "string", description: "JSON array of row arrays." } }, required: ["sheetId", "range", "values_json"], additionalProperties: false } },
  { name: "codex_task_create", description: "Prepare a Codex implementation task for explicit approval and local queueing.", category: "Development", permission: "requires_approval", status: "available", integration: "codex", approvalAction: "Queue Codex task", parameters: { type: "object", properties: { objective: { type: "string" } }, required: ["objective"], additionalProperties: false } },
  { name: "n8n_workflow_run", description: "Trigger an approved n8n workflow.", category: "Automation", permission: "requires_approval", status: "planned", integration: "n8n", approvalAction: "Run n8n workflow", parameters: { type: "object", properties: { workflow_id: { type: "string" }, input_json: { type: "string" } }, required: ["workflow_id"], additionalProperties: false } },
  { name: "slack_send", description: "Send an approved Slack message.", category: "Communication", permission: "requires_approval", status: "planned", integration: "slack", approvalAction: "Send Slack message", parameters: { type: "object", properties: { channel: { type: "string" }, message: { type: "string" } }, required: ["channel", "message"], additionalProperties: false } },
  { name: "sms_send", description: "Send an approved SMS message.", category: "Communication", permission: "requires_approval", status: "planned", integration: "twilio", approvalAction: "Send SMS message", parameters: { type: "object", properties: { to: { type: "string" }, message: { type: "string" } }, required: ["to", "message"], additionalProperties: false } },
];

export function liveAvaCapabilities() {
  return AVA_CAPABILITIES.filter((capability) => capability.status === "available");
}

export function avaRealtimeTools(): AvaRealtimeTool[] {
  return liveAvaCapabilities().map(({ name, description, parameters }) => ({ type: "function", name, description, parameters }));
}

function parameterText(parameters: Record<string, unknown>, key: string) {
  return typeof parameters[key] === "string" ? parameters[key].trim() : "";
}

function approvalTarget(capability: AvaCapabilityDefinition, parameters: Record<string, unknown>) {
  if (capability.name === "todoist_create") return parameterText(parameters, "task");
  if (capability.name === "todoist_complete") return parameterText(parameters, "task_name") || parameterText(parameters, "task_id");
  if (capability.name === "email_send") return `${parameterText(parameters, "to")} · ${parameterText(parameters, "subject")}`;
  if (capability.name === "calendar_create") return `${parameterText(parameters, "title")} · ${parameterText(parameters, "start")}`;
  if (capability.name === "sheets_write") return `${parameterText(parameters, "sheetId")} · ${parameterText(parameters, "range")}`;
  if (capability.name === "codex_task_create") return codexApprovalTarget(createCodexPromptPackage(parameterText(parameters, "objective"))!);
  return JSON.stringify(parameters).slice(0, 220);
}

function expectedResult(capability: AvaCapabilityDefinition) {
  return `Execute ${capability.name} once through Ava's verified server-side capability handler.`;
}

async function executeReadCapability({
  capability,
  parameters,
  supabase,
  ownerId,
  ownerEmail,
}: {
  capability: AvaCapabilityDefinition;
  parameters: Record<string, unknown>;
  supabase: SupabaseClient;
  ownerId: string;
  ownerEmail: string;
}): Promise<{ message: string; data?: unknown }> {
  const daily = async () => getAvaDailyContext({ supabase, ownerId });

  if (capability.name === "ava_context_current") {
    const value = await daily();
    const context = value.context;
    return { message: `${context.missionStatus}. ${context.personalSummary} ${context.businessSummary} Suggested focus: ${context.raw.cognitiveState.reasoning.suggestedFocus}`, data: { generatedAt: value.generatedAt, freshness: value.freshness, missionStatus: context.missionStatus, topPriorities: context.topPriorities, activeRisks: context.activeRisks } };
  }
  if (capability.name === "ava_context_changes") {
    const value = await daily();
    return { message: value.context.recentChanges.length ? value.context.recentChanges.slice(0, 8).map((change) => change.summary).join("; ") : "I do not see meaningful recent changes in the current snapshot.", data: value.context.recentChanges.slice(0, 8) };
  }
  if (capability.name === "ava_memory_recall") {
    const query = parameterText(parameters, "query").toLowerCase();
    const kind = parameterText(parameters, "kind");
    const scope = kind ? `ava_${kind === "working" ? "working_memory" : kind}` : "";
    let request = supabase.from("jarvis_memory").select("scope,memory_key,content,source,confidence,updated_at").eq("owner_id", ownerId).eq("active", true);
    if (scope) request = request.eq("scope", scope);
    const { data } = await request.order("updated_at", { ascending: false }).limit(60);
    const matches = (data || []).filter((row) => JSON.stringify(row).toLowerCase().includes(query)).slice(0, 12);
    return { message: matches.length ? matches.map((row) => `${row.scope}: ${JSON.stringify(row.content).slice(0, 260)} (confidence ${row.confidence ?? "unknown"}, source ${row.source || "unknown"})`).join("\n") : "I did not find an active memory matching that request.", data: matches };
  }
  if (capability.name === "ava_world_lookup") {
    const query = parameterText(parameters, "query").toLowerCase();
    const value = await daily();
    const matches = value.context.raw.cognitiveState.world.entities.filter((entity) => JSON.stringify(entity).toLowerCase().includes(query)).slice(0, 12);
    return { message: matches.length ? matches.map((entity) => `${entity.type} ${entity.name}: ${entity.currentState}; health ${entity.health}`).join("\n") : "I did not find a matching entity in the current world model.", data: matches };
  }
  if (capability.name === "ava_reasoning_evidence") {
    const value = await daily();
    const reasoning = value.context.raw.cognitiveState.reasoning;
    return { message: `Suggested focus: ${reasoning.suggestedFocus}. Priorities: ${reasoning.topPriorities.map((item) => item.title).join("; ") || "none"}. Risks: ${reasoning.openRisks.map((item) => item.title).join("; ") || "none"}.`, data: { reasoning, attention: value.context.raw.cognitiveState.attention.slice(0, 12), recommendations: value.context.recommendedActions } };
  }
  if (capability.name === "ava_source_health") {
    const value = await daily();
    return { message: `Context is ${value.freshness}, generated ${value.generatedAt}. ${value.sourceFailures.length ? `Unavailable sources: ${value.sourceFailures.join(", ")}.` : "No source failures are recorded."}`, data: { freshness: value.freshness, snapshotAgeMs: value.snapshotAgeMs, sourceFailures: value.sourceFailures, sourceStatus: value.sourceStatus } };
  }
  if (capability.name === "ava_approvals_pending") {
    const { data } = await supabase.from("jarvis_approvals").select("approval_id,action,target,expected_result,expires_at,created_at").eq("owner_id", ownerId).eq("status", "pending").order("created_at", { ascending: false }).limit(10);
    return { message: data?.length ? data.map((item) => `${item.action} for ${item.target}; expires ${item.expires_at || "not set"}`).join("\n") : "There are no pending approvals.", data };
  }
  if (capability.name === "ava_runtime_status" || capability.name === "ava_perception_current") {
    const runtime = getAvaRuntime();
    const status = runtime.getStatus();
    if (capability.name === "ava_runtime_status") return { message: `Runtime is ${status.lifecycleStage}; health ${status.health.status}; scheduler ${status.scheduler.status}.`, data: { status, state: runtime.store.getState() } };
    const diagnostics = runtime.perception.getDiagnostics();
    const stats = runtime.perception.getObservationStats();
    return { message: `${diagnostics.filter((adapter) => adapter.connected).length} of ${diagnostics.length} perception adapters are connected. Latest observation: ${stats.lastObservationAt || "none"}.`, data: { adapters: diagnostics, statistics: stats, lastObservation: runtime.perception.getLastObservation() } };
  }
  if (capability.name === "get_n8n_status") {
    const { data } = await supabase.from("jarvis_hud_overview").select("*").limit(1).maybeSingle();
    return { message: data ? `${data.active_workflows ?? 0} active workflows, ${data.executions_today ?? 0} executions today, ${data.errors_today ?? 0} errors, and ${data.open_issues ?? 0} open issues.` : "The n8n overview did not return data.", data };
  }
  if (capability.name === "email_draft") return { message: `Draft email to ${parameterText(parameters, "to")}\nSubject: ${parameterText(parameters, "subject")}\n\n${parameterText(parameters, "body")}`, data: parameters };
  if (capability.name === "calendar_draft") return { message: `Draft event: ${parameterText(parameters, "title")} from ${parameterText(parameters, "start")} to ${parameterText(parameters, "end")}. ${parameterText(parameters, "notes")}`, data: parameters };

  if (capability.toolHubTool) {
    const normalized = { ...parameters };
    if (capability.name === "todoist_list" && !normalized.filter) normalized.filter = "today | overdue";
    if (capability.name === "gmail_search" && !normalized.limit) normalized.limit = 10;
    if (capability.name === "sheets_write" && typeof normalized.values_json === "string") {
      try { normalized.values = JSON.parse(normalized.values_json); } catch { throw new Error("values_json must be valid JSON."); }
      delete normalized.values_json;
    }
    const result = await callToolHub({ tool: capability.toolHubTool, parameters: normalized, user: ownerEmail });
    if (!result.success) throw new Error(result.error || `${capability.toolHubTool} failed.`);
    if (capability.name === "todoist_list") {
      const tasks = extractTodoistTasks(result.data);
      return { message: tasks ? formatTodoistTasks(tasks) : "Todoist returned an unexpected response.", data: result.data };
    }
    if (capability.name === "gmail_search") return { message: formatGmailSearchResult(result.data), data: result.data };
    if (capability.name === "calendar_list") return { message: formatCalendarListResult(result.data), data: result.data };
    return { message: `${capability.name} completed.`, data: result.data };
  }
  throw new Error(`${capability.name} has no active handler.`);
}

export async function runAvaCapability({
  supabase,
  ownerId,
  ownerEmail,
  conversationId,
  callId,
  name,
  parameters,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  ownerEmail: string;
  conversationId: string;
  callId: string;
  name: string;
  parameters: Record<string, unknown>;
}): Promise<AvaToolResult> {
  const capability = AVA_CAPABILITIES.find((item) => item.name === name);
  if (!capability || capability.status !== "available") return { status: "unavailable", message: `${name} is not available.` };

  const { data: existing } = await supabase.from("jarvis_tool_calls")
    .select("tool_call_id,status,output_summary")
    .eq("owner_id", ownerId)
    .contains("input_summary", { gatewayCallId: callId })
    .limit(1)
    .maybeSingle();
  if (existing) return { status: existing.status === "complete" ? "complete" : existing.status === "approval_required" ? "approval_required" : "failed", message: (existing.output_summary as { response?: string } | null)?.response || "This tool call was already processed.", toolCallId: existing.tool_call_id };

  const inputSummary: Record<string, unknown> = { gatewayCallId: callId, parameters };
  if (capability.toolHubTool) inputSummary.toolHubTool = capability.toolHubTool;
  if (capability.name === "codex_task_create") inputSummary.codexPackage = createCodexPromptPackage(parameterText(parameters, "objective"));
  const approvalRequired = capability.permission === "requires_approval";
  const { data: toolCall, error } = await supabase.from("jarvis_tool_calls").insert({
    conversation_id: conversationId,
    owner_id: ownerId,
    tool_name: capability.name,
    permission_level: capability.permission,
    status: approvalRequired ? "approval_required" : "running",
    input_summary: inputSummary,
  }).select("tool_call_id").single();
  if (error || !toolCall) throw new Error(`Unable to record Ava tool call: ${error?.message || "Unknown error"}`);

  if (approvalRequired) {
    const target = approvalTarget(capability, parameters);
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const expected = expectedResult(capability);
    const { data: approval, error: approvalError } = await supabase.from("jarvis_approvals").insert({
      conversation_id: conversationId,
      tool_call_id: toolCall.tool_call_id,
      owner_id: ownerId,
      action: capability.approvalAction || capability.name,
      target,
      expected_result: expected,
      status: "pending",
      expires_at: expiresAt,
    }).select("approval_id").single();
    if (approvalError || !approval) throw new Error(`Unable to create Ava approval: ${approvalError?.message || "Unknown error"}`);
    const message = `I prepared ${capability.approvalAction || capability.name} for ${target}. It will ${expected.toLowerCase()} Say or type an explicit approval to continue.`;
    await supabase.from("jarvis_tool_calls").update({ output_summary: { response: message, approvalId: approval.approval_id } }).eq("tool_call_id", toolCall.tool_call_id);
    await supabase.from("jarvis_activity_log").insert({ owner_id: ownerId, conversation_id: conversationId, tool_call_id: toolCall.tool_call_id, activity_type: capability.name, summary: message, status: "approval_required", metadata: { approval_id: approval.approval_id } });
    return { status: "approval_required", message, toolCallId: toolCall.tool_call_id, approval: { id: approval.approval_id, action: capability.approvalAction || capability.name, target, expectedResult: expected, expiresAt } };
  }

  try {
    const result = await executeReadCapability({ capability, parameters, supabase, ownerId, ownerEmail });
    await supabase.from("jarvis_tool_calls").update({ status: "complete", output_summary: { response: result.message, data: result.data ?? null }, completed_at: new Date().toISOString() }).eq("tool_call_id", toolCall.tool_call_id);
    await supabase.from("jarvis_activity_log").insert({ owner_id: ownerId, conversation_id: conversationId, tool_call_id: toolCall.tool_call_id, activity_type: capability.name, summary: result.message.slice(0, 500), status: "complete", metadata: {} });
    return { status: "complete", message: result.message, data: result.data, toolCallId: toolCall.tool_call_id };
  } catch (executionError) {
    const message = executionError instanceof Error ? executionError.message : `${capability.name} failed.`;
    await supabase.from("jarvis_tool_calls").update({ status: "failed", error_message: message, output_summary: { response: message }, completed_at: new Date().toISOString() }).eq("tool_call_id", toolCall.tool_call_id);
    await supabase.from("jarvis_activity_log").insert({ owner_id: ownerId, conversation_id: conversationId, tool_call_id: toolCall.tool_call_id, activity_type: capability.name, summary: message, status: "failed", metadata: {} });
    return { status: "failed", message, toolCallId: toolCall.tool_call_id };
  }
}
