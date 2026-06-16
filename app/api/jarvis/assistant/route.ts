import { NextResponse } from "next/server";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";
import { discoverIntegrationCredentials } from "@/lib/jarvis/integrations";
import { approvalForTool, toolCanRunWithoutApproval } from "@/lib/jarvis/permissions";
import { findToolForMessage, JARVIS_TOOLS } from "@/lib/jarvis/tool-registry";
import { askOpenAI, openAIConfigured } from "@/lib/jarvis/openai";
import { callToolHub, extractTodoistTasks, formatTodoistTasks, type TodoistTask } from "@/lib/jarvis/tool-hub";
import type { AssistantResponse } from "@/lib/jarvis/types";

const MAX_MESSAGE_LENGTH = 4000;

export async function GET() {
  const { authorized, supabase } = await requireJarvisAdmin();
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: activity }, { data: approvals }, { data: conversation }] = await Promise.all([
    supabase.from("jarvis_activity_log").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("jarvis_approvals").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
    supabase.from("jarvis_conversations").select("conversation_id").eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: messages } = conversation?.conversation_id
    ? await supabase.from("jarvis_messages").select("message_id, role, content, metadata").eq("conversation_id", conversation.conversation_id).order("created_at").limit(100)
    : { data: [] };

  return NextResponse.json({
    tools: JARVIS_TOOLS,
    integrations: discoverIntegrationCredentials(),
    activity: activity ?? [],
    approvals: approvals ?? [],
    conversationId: conversation?.conversation_id ?? null,
    messages: messages ?? [],
  });
}

export async function POST(request: Request) {
  const { authorized, supabase, user } = await requireJarvisAdmin();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const requestedConversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  const { data: conversationHistory } = requestedConversationId
    ? await supabase.from("jarvis_messages").select("role, content").eq("conversation_id", requestedConversationId).order("created_at").limit(20)
    : { data: [] };
  const tool = findToolForMessage(message);
  let response: AssistantResponse = {
    message: "I have recorded that request. Phase 1 is online, and I can route it once the matching capability is connected.",
    activity: "Jarvis received an assistant request",
  };

  if (tool?.name === "get_n8n_status") {
    const { data } = await supabase.from("jarvis_hud_overview").select("*").limit(1).single();
    response = {
      tool,
      message: data
        ? `Current automation status: ${data.active_workflows ?? 0} active workflows, ${data.executions_today ?? 0} executions today, ${data.errors_today ?? 0} errors, and ${data.open_issues ?? 0} open issues.`
        : "The monitoring connection is available, but no overview metrics were returned.",
      activity: "Jarvis summarized n8n status",
    };
  } else if (tool?.name === "todoist.list") {
    const toolHubResponse = await callToolHub<TodoistTask[]>({
      tool: "todoist.list",
      parameters: { filter: "today | overdue" },
      user: user.email ?? "cody",
    });
    const todoistTasks = extractTodoistTasks(toolHubResponse.data);
    response = {
      tool,
      message: toolHubResponse.success && todoistTasks
        ? formatTodoistTasks(todoistTasks)
        : `Todoist is connected, but the Tool Hub request failed: ${toolHubResponse.error || "Unexpected Tool Hub response format"}`,
      activity: toolHubResponse.success ? "Jarvis listed Todoist tasks" : "Jarvis encountered a Todoist Tool Hub error",
    };
  } else if (tool && tool.status === "credential_needed") {
    response = {
      tool,
      message: `${tool.description} The ${tool.integration} credential still needs to be connected before I can use this capability.`,
      activity: `Jarvis identified a credential requirement for ${tool.integration}`,
    };
  } else if (tool && !toolCanRunWithoutApproval(tool)) {
    response = {
      tool,
      approval: approvalForTool(tool, message),
      message: "This action requires approval. I prepared the request but did not execute anything.",
      activity: `Jarvis requested approval for ${tool.name}`,
    };
  } else if (tool) {
    response = {
      tool,
      message: `${tool.description} The Phase 1 tool contract is ready; the implementation handler is the next integration step.`,
      activity: `Jarvis routed request to ${tool.name}`,
    };
  } else if (openAIConfigured()) {
    try {
      const modelResponse = await askOpenAI({
        message,
        history: conversationHistory ?? [],
        tools: JARVIS_TOOLS,
      });
      if (modelResponse) {
        response = {
          message: modelResponse,
          activity: "Jarvis answered with OpenAI reasoning",
        };
      }
    } catch (error) {
      console.error("Jarvis OpenAI request failed", error);
      response = {
        message: "My OpenAI reasoning connection encountered an error. The deterministic monitoring and approval systems remain online.",
        activity: "Jarvis encountered an OpenAI reasoning error",
      };
    }
  }

  const { data: existingConversation } = requestedConversationId
    ? await supabase.from("jarvis_conversations").select("conversation_id").eq("conversation_id", requestedConversationId).maybeSingle()
    : { data: null };
  const { data: createdConversation } = existingConversation
    ? { data: existingConversation }
    : await supabase.from("jarvis_conversations").insert({
      owner_id: user.id,
      title: message.slice(0, 80),
    }).select("conversation_id").single();
  const conversationId = createdConversation?.conversation_id ?? null;

  if (conversationId) {
    await supabase.from("jarvis_messages").insert({
      conversation_id: conversationId,
      owner_id: user.id,
      role: "user",
      content: message,
    });
  }

  const toolStatus = response.approval ? "approval_required" : tool ? "complete" : "planned";
  const { data: toolCall } = tool && conversationId
    ? await supabase.from("jarvis_tool_calls").insert({
      conversation_id: conversationId,
      owner_id: user.id,
      tool_name: tool.name,
      permission_level: tool.permission,
      status: toolStatus,
      input_summary: { request: message },
      output_summary: { response: response.message },
    }).select("tool_call_id").single()
    : { data: null };

  await supabase.from("jarvis_activity_log").insert({
    owner_id: user.id,
    conversation_id: conversationId,
    tool_call_id: toolCall?.tool_call_id ?? null,
    activity_type: tool?.name ?? "assistant_request",
    summary: response.activity,
    status: response.approval ? "approval_required" : "complete",
    metadata: { tool: tool?.name ?? null },
  });

  if (response.approval) {
    const { data: approval } = await supabase.from("jarvis_approvals").insert({
      owner_id: user.id,
      conversation_id: conversationId,
      tool_call_id: toolCall?.tool_call_id ?? null,
      action: response.approval.action,
      target: response.approval.target,
      expected_result: response.approval.expectedResult,
      status: "pending",
    }).select("approval_id").single();
    if (approval?.approval_id) response.approval.id = approval.approval_id;
  }

  if (conversationId) {
    await supabase.from("jarvis_messages").insert({
      conversation_id: conversationId,
      owner_id: user.id,
      role: "assistant",
      content: response.message,
      metadata: {
        tool: tool?.name ?? null,
        approval: response.approval ?? null,
      },
    });
    await supabase.from("jarvis_conversations").update({ updated_at: new Date().toISOString() }).eq("conversation_id", conversationId);
    response.conversationId = conversationId;
  }

  return NextResponse.json(response);
}
