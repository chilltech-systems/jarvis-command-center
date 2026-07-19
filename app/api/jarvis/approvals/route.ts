import { NextResponse } from "next/server";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";
import { refreshAvaDailyContext } from "@/lib/ava/daily-context";
import type { CodexPromptPackage } from "@/lib/jarvis/codex";
import { callToolHub, formatTodoistCreateResult, type TodoistCreateParameters } from "@/lib/jarvis/tool-hub";
import { createAdminClient } from "@/lib/supabase/admin";

type ToolHubApprovalInput = {
  parameters?: Record<string, unknown>;
  toolHubTool?: string;
};

export async function PATCH(request: Request) {
  const { authorized, supabase, user } = await requireJarvisAdmin();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const approvalId = typeof body.approvalId === "string" ? body.approvalId : "";
  const status = body.status === "approved" || body.status === "denied" ? body.status : "";
  if (!approvalId || !status) return NextResponse.json({ error: "Valid approvalId and status are required" }, { status: 400 });

  const { data, error } = await supabase
    .from("jarvis_approvals")
    .update({ status, decided_at: new Date().toISOString(), decided_by: user.id })
    .eq("approval_id", approvalId)
    .eq("status", "pending")
    .select("approval_id, action, target, status, conversation_id, tool_call_id")
    .single();

  if (error || !data) return NextResponse.json({ error: "Approval was not found or already decided" }, { status: 409 });

  let message = `Ava action ${status}: ${data.action}`;
  let executionStatus = status;

  if (status === "approved" && data.tool_call_id) {
    const { data: toolCall } = await supabase
      .from("jarvis_tool_calls")
      .select("tool_call_id, tool_name, input_summary")
      .eq("tool_call_id", data.tool_call_id)
      .eq("owner_id", user.id)
      .single();

    if (toolCall?.tool_name === "ava.context.refresh_override") {
      const result = await refreshAvaDailyContext({
        supabase: createAdminClient(),
        ownerId: user.id,
        kind: "manual",
      });
      const completed = result.status === "success" || result.status === "partial";
      executionStatus = completed ? "executed" : "failed";
      message = completed
        ? `Ava daily context refresh ${result.status}. ${result.context.usage.remainingExecutions} context executions remain today.`
        : `Ava daily context refresh ${result.status}: ${result.reason || "The refresh did not complete."}`;
      await supabase.from("jarvis_tool_calls").update({
        status: completed ? "complete" : "failed",
        output_summary: { response: message, refreshStatus: result.status, usage: result.context.usage },
        error_message: completed ? null : result.reason,
        completed_at: new Date().toISOString(),
      }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
      await supabase.from("jarvis_approvals").update({
        status: completed ? "executed" : "failed",
      }).eq("approval_id", approvalId).eq("owner_id", user.id);
    } else if (toolCall?.tool_name === "create_codex_task") {
      const codexPackage = (toolCall.input_summary as { codexPackage?: CodexPromptPackage } | null)?.codexPackage;
      if (!codexPackage?.prompt) {
        executionStatus = "failed";
        message = "Codex prompt queueing failed: missing prompt package.";
        await supabase.from("jarvis_tool_calls").update({
          status: "failed",
          error_message: "Missing Codex prompt package",
          completed_at: new Date().toISOString(),
        }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
        await supabase.from("jarvis_approvals").update({ status: "failed" }).eq("approval_id", approvalId).eq("owner_id", user.id);
      } else {
        const { data: run, error: runError } = await supabase.from("jarvis_codex_runs").insert({
          conversation_id: data.conversation_id,
          tool_call_id: data.tool_call_id,
          approval_id: approvalId,
          owner_id: user.id,
          title: codexPackage.title,
          objective: codexPackage.objective,
          workspace_path: codexPackage.workspace,
          prompt: codexPackage.prompt,
          status: "queued",
          requested_by_email: user.email,
          metadata: { source: "jarvis-command-center" },
        }).select("run_id").single();

        if (runError || !run?.run_id) {
          executionStatus = "failed";
          message = `Codex prompt queueing failed: ${runError?.message || "Unknown Supabase error"}`;
          await supabase.from("jarvis_tool_calls").update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
          await supabase.from("jarvis_approvals").update({ status: "failed" }).eq("approval_id", approvalId).eq("owner_id", user.id);
        } else {
          executionStatus = "executed";
          message = `Codex prompt queued for local runner: ${codexPackage.title}`;
          await supabase.from("jarvis_tool_calls").update({
            status: "complete",
            output_summary: { response: message, codexRunId: run.run_id },
            completed_at: new Date().toISOString(),
          }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
          await supabase.from("jarvis_approvals").update({ status: "executed" }).eq("approval_id", approvalId).eq("owner_id", user.id);
        }
      }
    } else if (toolCall?.tool_name === "todoist.create") {
      const parameters = (toolCall.input_summary as { parameters?: TodoistCreateParameters } | null)?.parameters;
      if (!parameters?.task) {
        executionStatus = "failed";
        message = "Todoist task creation failed: missing task details.";
        await supabase.from("jarvis_tool_calls").update({
          status: "failed",
          error_message: "Missing Todoist task details",
          completed_at: new Date().toISOString(),
        }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
      } else {
        await supabase.from("jarvis_tool_calls").update({ status: "running" }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
        const result = await callToolHub({
          tool: "todoist.create",
          parameters,
          user: user.email ?? "cody",
        });
        if (result.success) {
          executionStatus = "executed";
          message = formatTodoistCreateResult(result.data);
          await supabase.from("jarvis_tool_calls").update({
            status: "complete",
            output_summary: { response: message, toolHub: result.data ?? null },
            completed_at: new Date().toISOString(),
          }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
          await supabase.from("jarvis_approvals").update({ status: "executed" }).eq("approval_id", approvalId).eq("owner_id", user.id);
        } else {
          executionStatus = "failed";
          message = `Todoist task creation failed: ${result.error || "Unexpected Tool Hub response"}`;
          await supabase.from("jarvis_tool_calls").update({
            status: "failed",
            error_message: result.error || "Unexpected Tool Hub response",
            output_summary: { response: message },
            completed_at: new Date().toISOString(),
          }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
          await supabase.from("jarvis_approvals").update({ status: "failed" }).eq("approval_id", approvalId).eq("owner_id", user.id);
        }
      }
    } else if (["send_email", "send_slack_message", "send_sms", "create_calendar_event", "write_google_sheet"].includes(toolCall?.tool_name || "")) {
      const { parameters, toolHubTool } = (toolCall?.input_summary as ToolHubApprovalInput | null) || {};
      if (!parameters || !toolHubTool) {
        executionStatus = "failed";
        message = "Approved Tool Hub action failed: missing execution parameters.";
        await supabase.from("jarvis_tool_calls").update({
          status: "failed",
          error_message: "Missing Tool Hub action parameters",
          completed_at: new Date().toISOString(),
        }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
      } else {
        await supabase.from("jarvis_tool_calls").update({ status: "running" }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
        const result = await callToolHub({
          tool: toolHubTool,
          parameters,
          user: user.email ?? "cody",
        });
        if (result.success) {
          executionStatus = "executed";
          message = `I completed the approved ${toolHubTool} action.`;
          await supabase.from("jarvis_tool_calls").update({
            status: "complete",
            output_summary: { response: message, toolHub: result.data ?? null },
            completed_at: new Date().toISOString(),
          }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
          await supabase.from("jarvis_approvals").update({ status: "executed" }).eq("approval_id", approvalId).eq("owner_id", user.id);
        } else {
          executionStatus = "failed";
          message = `Approved ${toolHubTool} action failed: ${result.error || "Unexpected Tool Hub response"}`;
          await supabase.from("jarvis_tool_calls").update({
            status: "failed",
            error_message: result.error || "Unexpected Tool Hub response",
            output_summary: { response: message },
            completed_at: new Date().toISOString(),
          }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
          await supabase.from("jarvis_approvals").update({ status: "failed" }).eq("approval_id", approvalId).eq("owner_id", user.id);
        }
      }
    }
  } else if (status === "denied" && data.tool_call_id) {
    await supabase.from("jarvis_tool_calls").update({
      status: "denied",
      completed_at: new Date().toISOString(),
    }).eq("tool_call_id", data.tool_call_id).eq("owner_id", user.id);
  }

  await supabase.from("jarvis_activity_log").insert({
    owner_id: user.id,
    conversation_id: data.conversation_id,
    tool_call_id: data.tool_call_id,
    activity_type: "approval_decision",
    summary: message,
    status: executionStatus,
    metadata: { approval_id: approvalId, target: data.target },
  });

  if (data.conversation_id) {
    await supabase.from("jarvis_messages").insert({
      conversation_id: data.conversation_id,
      owner_id: user.id,
      role: "assistant",
      content: message,
      metadata: { approval_id: approvalId, status: executionStatus },
    });
    await supabase.from("jarvis_conversations").update({ updated_at: new Date().toISOString() }).eq("conversation_id", data.conversation_id);
  }

  return NextResponse.json({ ...data, status: executionStatus, message });
}
