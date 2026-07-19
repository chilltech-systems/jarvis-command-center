import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOutcomeMemories, writeSecondBrainMemory } from "@/lib/ava/core/second-brain-memory";
import type { AvaSupabaseLike } from "@/lib/ava/core/types";
import type { CodexPromptPackage } from "@/lib/jarvis/codex";
import { callToolHub, formatTodoistCreateResult } from "@/lib/jarvis/tool-hub";
import type { AvaToolResult } from "@/lib/ava/gateway/types";

function normalizedConfirmation(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
}

export function isExplicitAvaApproval(value: string) {
  const confirmation = normalizedConfirmation(value);
  return /^(approve|approved|i approve|yes do it|yes go ahead|go ahead|do it|send it|create it|complete it|run it|execute it|yes send it|yes create it|yes complete it)$/.test(confirmation)
    || /^(approve|send|create|complete|run|execute)\s+(that|this|the)\b/.test(confirmation);
}

export function isExplicitAvaDenial(value: string) {
  const confirmation = normalizedConfirmation(value);
  return /^(deny|denied|reject|rejected|cancel|cancel it|do not do it|don't do it|no stop|no cancel it)$/.test(confirmation);
}

async function rememberOutcome({
  supabase,
  ownerId,
  toolCallId,
  action,
  outcome,
  status,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  toolCallId: string;
  action: string;
  outcome: string;
  status: "succeeded" | "failed" | "rejected";
}) {
  const memories = createOutcomeMemories({ actionId: toolCallId, action, outcome, status, source: "ava-nebula" });
  const memoryClient = supabase as unknown as AvaSupabaseLike;
  await Promise.all([
    writeSecondBrainMemory({ supabase: memoryClient, ownerId, memory: memories.episode }),
    writeSecondBrainMemory({ supabase: memoryClient, ownerId, memory: memories.feedback }),
  ]);
}

async function executeApprovedTool({
  supabase,
  ownerId,
  ownerEmail,
  conversationId,
  approvalId,
  toolCall,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  ownerEmail: string;
  conversationId: string | null;
  approvalId: string;
  toolCall: { tool_call_id: string; tool_name: string; input_summary: Record<string, unknown> | null };
}) {
  const input = toolCall.input_summary || {};
  const parameters = input.parameters && typeof input.parameters === "object" ? input.parameters as Record<string, unknown> : {};
  let message = "";
  let data: unknown = null;

  await supabase.from("jarvis_tool_calls").update({ status: "running" }).eq("tool_call_id", toolCall.tool_call_id).eq("owner_id", ownerId);

  if (toolCall.tool_name === "codex_task_create") {
    const codexPackage = input.codexPackage as CodexPromptPackage | null;
    if (!codexPackage?.prompt) throw new Error("The approved Codex task is missing its prompt package.");
    const { data: run, error } = await supabase.from("jarvis_codex_runs").insert({
      conversation_id: conversationId,
      tool_call_id: toolCall.tool_call_id,
      approval_id: approvalId,
      owner_id: ownerId,
      title: codexPackage.title,
      objective: codexPackage.objective,
      workspace_path: codexPackage.workspace,
      prompt: codexPackage.prompt,
      status: "queued",
      requested_by_email: ownerEmail,
      metadata: { source: "ava-nebula" },
    }).select("run_id").single();
    if (error || !run) throw new Error(error?.message || "Codex task queueing failed.");
    message = `I queued the approved Codex task: ${codexPackage.title}.`;
    data = { codexRunId: run.run_id };
  } else {
    const toolHubTool = typeof input.toolHubTool === "string" ? input.toolHubTool : "";
    if (!toolHubTool) throw new Error("The approved action has no active Tool Hub executor.");
    const normalizedParameters = { ...parameters };
    if (toolCall.tool_name === "sheets_write" && typeof normalizedParameters.values_json === "string") {
      try { normalizedParameters.values = JSON.parse(normalizedParameters.values_json); } catch { throw new Error("The approved Sheets values are not valid JSON."); }
      delete normalizedParameters.values_json;
    }
    const result = await callToolHub({ tool: toolHubTool, parameters: normalizedParameters, user: ownerEmail });
    if (!result.success) throw new Error(result.error || `${toolHubTool} failed.`);
    data = result.data ?? null;
    message = toolCall.tool_name === "todoist_create"
      ? formatTodoistCreateResult(result.data)
      : `I completed the approved ${toolHubTool} action.`;
  }

  await supabase.from("jarvis_tool_calls").update({ status: "complete", output_summary: { response: message, data }, completed_at: new Date().toISOString(), error_message: null }).eq("tool_call_id", toolCall.tool_call_id).eq("owner_id", ownerId);
  await supabase.from("jarvis_approvals").update({ status: "executed" }).eq("approval_id", approvalId).eq("owner_id", ownerId);
  return { message, data };
}

export async function resolveAvaApproval({
  supabase,
  ownerId,
  ownerEmail,
  conversationId,
  approvalId,
  decision,
  confirmationText,
  modality,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  ownerEmail: string;
  conversationId: string;
  approvalId: string;
  decision: "approved" | "denied";
  confirmationText: string;
  modality: "voice" | "text";
}): Promise<AvaToolResult> {
  const { data: approval } = await supabase.from("jarvis_approvals")
    .select("approval_id,conversation_id,tool_call_id,action,target,expected_result,status,expires_at")
    .eq("approval_id", approvalId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!approval || approval.conversation_id !== conversationId) return { status: "failed", message: "That approval does not belong to this conversation." };

  if (approval.status !== "pending") {
    const { data: previousTool } = approval.tool_call_id
      ? await supabase.from("jarvis_tool_calls").select("tool_call_id,status,output_summary,error_message").eq("tool_call_id", approval.tool_call_id).eq("owner_id", ownerId).maybeSingle()
      : { data: null };
    return {
      status: previousTool?.status === "complete" ? "complete" : "failed",
      message: (previousTool?.output_summary as { response?: string } | null)?.response || `That approval is already ${approval.status}.`,
      toolCallId: previousTool?.tool_call_id,
    };
  }

  if (approval.expires_at && Date.parse(approval.expires_at) <= Date.now()) {
    await supabase.from("jarvis_approvals").update({ status: "expired" }).eq("approval_id", approvalId).eq("owner_id", ownerId);
    if (approval.tool_call_id) await supabase.from("jarvis_tool_calls").update({ status: "failed", error_message: "Approval expired", completed_at: new Date().toISOString() }).eq("tool_call_id", approval.tool_call_id).eq("owner_id", ownerId);
    return { status: "failed", message: "That approval expired. Ask me to prepare the action again." };
  }

  const explicit = decision === "approved" ? isExplicitAvaApproval(confirmationText) : isExplicitAvaDenial(confirmationText);
  if (!explicit) return { status: "approval_required", message: `I need an explicit ${decision === "approved" ? "approval" : "denial"} for ${approval.action} for ${approval.target}.`, approval: { id: approvalId, action: approval.action, target: approval.target, expectedResult: approval.expected_result, expiresAt: approval.expires_at } };

  if (!approval.tool_call_id) return { status: "failed", message: "That approval is missing its bound action." };
  const { data: toolCall } = await supabase.from("jarvis_tool_calls").select("tool_call_id,tool_name,input_summary").eq("tool_call_id", approval.tool_call_id).eq("owner_id", ownerId).maybeSingle();
  if (!toolCall) return { status: "failed", message: "The approved action could not be found." };

  if (decision === "denied") {
    const message = `I cancelled ${approval.action} for ${approval.target}.`;
    await supabase.from("jarvis_approvals").update({ status: "denied", decided_at: new Date().toISOString(), decided_by: ownerId }).eq("approval_id", approvalId).eq("owner_id", ownerId);
    await supabase.from("jarvis_tool_calls").update({ status: "denied", output_summary: { response: message }, completed_at: new Date().toISOString() }).eq("tool_call_id", toolCall.tool_call_id).eq("owner_id", ownerId);
    await rememberOutcome({ supabase, ownerId, toolCallId: toolCall.tool_call_id, action: approval.action, outcome: message, status: "rejected" });
    await supabase.from("jarvis_activity_log").insert({ owner_id: ownerId, conversation_id: conversationId, tool_call_id: toolCall.tool_call_id, activity_type: "approval_decision", summary: message, status: "denied", metadata: { approval_id: approvalId, modality } });
    return { status: "complete", message, toolCallId: toolCall.tool_call_id };
  }

  await supabase.from("jarvis_approvals").update({ status: "approved", decided_at: new Date().toISOString(), decided_by: ownerId }).eq("approval_id", approvalId).eq("owner_id", ownerId);
  try {
    const result = await executeApprovedTool({ supabase, ownerId, ownerEmail, conversationId, approvalId, toolCall });
    await rememberOutcome({ supabase, ownerId, toolCallId: toolCall.tool_call_id, action: approval.action, outcome: result.message, status: "succeeded" });
    await supabase.from("jarvis_activity_log").insert({ owner_id: ownerId, conversation_id: conversationId, tool_call_id: toolCall.tool_call_id, activity_type: "approval_decision", summary: result.message, status: "executed", metadata: { approval_id: approvalId, modality } });
    return { status: "complete", message: result.message, data: result.data, toolCallId: toolCall.tool_call_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The approved action failed.";
    await supabase.from("jarvis_approvals").update({ status: "failed" }).eq("approval_id", approvalId).eq("owner_id", ownerId);
    await supabase.from("jarvis_tool_calls").update({ status: "failed", error_message: message, output_summary: { response: message }, completed_at: new Date().toISOString() }).eq("tool_call_id", toolCall.tool_call_id).eq("owner_id", ownerId);
    await rememberOutcome({ supabase, ownerId, toolCallId: toolCall.tool_call_id, action: approval.action, outcome: message, status: "failed" });
    await supabase.from("jarvis_activity_log").insert({ owner_id: ownerId, conversation_id: conversationId, tool_call_id: toolCall.tool_call_id, activity_type: "approval_decision", summary: message, status: "failed", metadata: { approval_id: approvalId, modality } });
    return { status: "failed", message, toolCallId: toolCall.tool_call_id };
  }
}
