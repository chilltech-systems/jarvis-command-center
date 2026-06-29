import { NextResponse } from "next/server";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";
import { codexApprovalTarget, createCodexPromptPackage, formatCodexPromptPackage } from "@/lib/jarvis/codex";
import { discoverIntegrationCredentials } from "@/lib/jarvis/integrations";
import { approvalForTool, toolCanRunWithoutApproval } from "@/lib/jarvis/permissions";
import { findToolForMessage, JARVIS_TOOLS } from "@/lib/jarvis/tool-registry";
import { askOpenAI, openAIConfigured } from "@/lib/jarvis/openai";
import {
  buildDashboardContext,
  buildTrendContext,
  summarizeDashboardContext,
  upsertDailyDashboardSnapshot,
} from "@/lib/jarvis/dashboard-context";
import {
  callToolHub,
  extractTodoistTasks,
  formatCalendarListResult,
  formatGmailSearchResult,
  formatSheetReadResult,
  formatTodoistTasks,
  parseTodoistCreateRequest,
  type TodoistTask,
} from "@/lib/jarvis/tool-hub";
import type { AssistantResponse } from "@/lib/jarvis/types";

const MAX_MESSAGE_LENGTH = 4000;

function parseAfter(message: string, patterns: RegExp[]) {
  return patterns.map((pattern) => message.match(pattern)?.[1]?.trim()).find(Boolean) || "";
}

function parseEmailSendRequest(message: string) {
  const to = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const subject = parseAfter(message, [/\bsubject[:\s]+(.+?)(?:\s+(?:body|saying|message)[:\s]+|$)/i]);
  const body = parseAfter(message, [/\b(?:body|saying|message)[:\s]+(.+)$/i, /\bto\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\s+(.+)$/i]);
  if (!to || !body) return null;
  return { to, subject: subject || "Ava message", body };
}

function parseSlackSendRequest(message: string) {
  const channel = message.match(/#[a-z0-9_-]+/i)?.[0] || parseAfter(message, [/\bchannel[:\s]+([A-Z0-9][A-Z0-9_-]*)/i]);
  const text = parseAfter(message, [/\b(?:saying|message|text)[:\s]+(.+)$/i, /\bto\s+#[a-z0-9_-]+\s+(.+)$/i]);
  if (!channel || !text) return null;
  return { channel, message: text };
}

function parseSmsSendRequest(message: string) {
  const to = message.match(/\+?\d[\d\s().-]{8,}\d/)?.[0]?.replace(/[^\d+]/g, "") || "";
  const text = parseAfter(message, [/\b(?:saying|message|text)[:\s]+(.+)$/i, /\bto\s+\+?\d[\d\s().-]{8,}\d\s+(.+)$/i]);
  if (!to || !text) return null;
  return { to, message: text };
}

function parseSheetReadRequest(message: string) {
  const sheetId = parseAfter(message, [/\bsheet(?:Id| id)?[:\s]+([A-Za-z0-9_-]{20,})/i]);
  const range = parseAfter(message, [/\brange[:\s]+([A-Za-z0-9_ '!:$.-]+)/i]);
  if (!sheetId || !range) return null;
  return { sheetId, range };
}

function parseCalendarCreateRequest(message: string) {
  const title = parseAfter(message, [/\b(?:event|meeting|appointment)\s+(?:called|named|for)\s+(.+?)(?:\s+\b(?:from|at|on)\b|$)/i, /\btitle[:\s]+(.+?)(?:\s+\b(?:start|from|at)\b|$)/i]);
  const start = parseAfter(message, [/\bstart[:\s]+(.+?)(?:\s+\bend\b|$)/i, /\bfrom[:\s]+(.+?)(?:\s+\bto\b|$)/i]);
  const end = parseAfter(message, [/\bend[:\s]+(.+)$/i, /\bto[:\s]+(.+)$/i]);
  if (!title || !start || !end) return null;
  return { title, start, end };
}

export async function GET(request: Request) {
  const { authorized, supabase, user } = await requireJarvisAdmin();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dashboardPath = new URL(request.url).searchParams.get("path") || "/";

  const [{ data: activity }, { data: approvals }, { data: conversation }] = await Promise.all([
    supabase.from("jarvis_activity_log").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("jarvis_approvals").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(10),
    supabase.from("jarvis_conversations").select("conversation_id").eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: messages } = conversation?.conversation_id
    ? await supabase.from("jarvis_messages").select("message_id, role, content, metadata").eq("conversation_id", conversation.conversation_id).order("created_at").limit(100)
    : { data: [] };
  const dashboardContext = await buildDashboardContext({ supabase, ownerId: user.id, path: dashboardPath });
  await upsertDailyDashboardSnapshot({ supabase, ownerId: user.id, context: dashboardContext });
  const trendContext = await buildTrendContext({ supabase, ownerId: user.id });

  return NextResponse.json({
    tools: JARVIS_TOOLS,
    integrations: discoverIntegrationCredentials(),
    dashboardContext,
    trendContext,
    capabilitySummary: dashboardContext.capabilitySummary,
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
  const dashboardPath = typeof body.dashboardPath === "string" ? body.dashboardPath : "/";

  const requestedConversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  const { data: conversationHistory } = requestedConversationId
    ? await supabase.from("jarvis_messages").select("role, content").eq("conversation_id", requestedConversationId).order("created_at").limit(20)
    : { data: [] };
  const tool = findToolForMessage(message);
  const dashboardContext = await buildDashboardContext({ supabase, ownerId: user.id, path: dashboardPath });
  await upsertDailyDashboardSnapshot({ supabase, ownerId: user.id, context: dashboardContext });
  const trendContext = await buildTrendContext({ supabase, ownerId: user.id });
  let response: AssistantResponse = {
    message: "I recorded that request. I can route it once the matching capability is connected.",
    activity: "I received an assistant request",
  };
  let toolInputSummary: Record<string, unknown> = { request: message };

  if (!tool && /(what am i looking at|what is displayed|current page|this dashboard|on this page|what's on this page)/i.test(message)) {
    response = {
      message: summarizeDashboardContext(dashboardContext, trendContext),
      activity: "I summarized the current dashboard context",
    };
  } else if (!tool && /(what changed|trend|trends|recently|history|past data)/i.test(message)) {
    response = {
      message: `I checked my dashboard trend memory. ${trendContext.summary.join("; ")}.`,
      activity: "I summarized dashboard trends",
    };
  } else if (tool?.status === "planned") {
    response = {
      tool,
      message: `I found the ${tool.integration} connection path, but the production executor for ${tool.name} is not active yet. I can use it after the real Tool Hub executor workflow is built and activated.`,
      activity: `I identified a planned tool: ${tool.name}`,
    };
  } else if (tool?.name === "get_n8n_status") {
    const { data } = await supabase.from("jarvis_hud_overview").select("*").limit(1).single();
    response = {
      tool,
      message: data
        ? `I found ${data.active_workflows ?? 0} active workflows, ${data.executions_today ?? 0} executions today, ${data.errors_today ?? 0} errors, and ${data.open_issues ?? 0} open issues.`
        : "I can reach the monitoring connection, but it did not return overview metrics.",
      activity: "I summarized n8n status",
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
        : `I can see Todoist is connected, but the Tool Hub request failed: ${toolHubResponse.error || "Unexpected Tool Hub response format"}`,
      activity: toolHubResponse.success ? "I listed Todoist tasks" : "I encountered a Todoist Tool Hub error",
    };
  } else if (tool?.name === "get_recent_emails") {
    const query = parseAfter(message, [/\b(?:search|find|query)\s+(?:gmail|email|inbox)\s+(?:for\s+)?(.+)$/i]) || "in:inbox newer_than:7d -category:promotions -category:social";
    const toolHubResponse = await callToolHub({
      tool: "gmail.search",
      parameters: { query, limit: 10 },
      user: user.email ?? "cody",
    });
    response = {
      tool,
      message: toolHubResponse.success
        ? formatGmailSearchResult(toolHubResponse.data)
        : `I tried to search Gmail, but Tool Hub returned: ${toolHubResponse.error || "Unexpected Tool Hub response"}`,
      activity: toolHubResponse.success ? "I searched Gmail" : "I encountered a Gmail Tool Hub error",
    };
  } else if (tool?.name === "draft_email") {
    response = {
      tool,
      message: "I can draft the email here without sending it. Tell me the recipient, subject, and the message you want me to prepare.",
      activity: "I prepared to draft an email",
    };
  } else if (tool?.name === "send_email") {
    const parameters = parseEmailSendRequest(message);
    if (!parameters) {
      response = {
        tool,
        message: "I can send approved Gmail messages. Give me the recipient email and message body, for example: send email to name@example.com subject Check-in body I will follow up today.",
        activity: "I requested Gmail send details",
      };
    } else {
      toolInputSummary = { request: message, parameters, toolHubTool: "gmail.send" };
      response = {
        tool,
        approval: {
          action: tool.approvalAction ?? "Send Gmail message",
          target: `${parameters.to} · ${parameters.subject}`,
          expectedResult: "Send this Gmail message through Tool Hub after approval.",
          status: "pending",
        },
        message: "I prepared that Gmail message. Approve it and I will send it.",
        activity: "I requested approval for gmail.send",
      };
    }
  } else if (tool?.name === "get_calendar_events") {
    const toolHubResponse = await callToolHub({
      tool: "calendar.list",
      parameters: {},
      user: user.email ?? "cody",
    });
    response = {
      tool,
      message: toolHubResponse.success
        ? formatCalendarListResult(toolHubResponse.data)
        : `I tried to read Calendar, but Tool Hub returned: ${toolHubResponse.error || "Unexpected Tool Hub response"}`,
      activity: toolHubResponse.success ? "I listed calendar events" : "I encountered a Calendar Tool Hub error",
    };
  } else if (tool?.name === "draft_calendar_event") {
    response = {
      tool,
      message: "I can draft the calendar event here without creating it. Tell me the title, start, end, and any notes you want included.",
      activity: "I prepared to draft a calendar event",
    };
  } else if (tool?.name === "create_calendar_event") {
    const parameters = parseCalendarCreateRequest(message);
    if (!parameters) {
      response = {
        tool,
        message: "I can create approved calendar events. Give me a title, start, and end, for example: create calendar event called Review from 2026-06-30 10:00 to 2026-06-30 10:30.",
        activity: "I requested calendar event details",
      };
    } else {
      toolInputSummary = { request: message, parameters, toolHubTool: "calendar.create" };
      response = {
        tool,
        approval: {
          action: tool.approvalAction ?? "Create calendar event",
          target: `${parameters.title} · ${parameters.start} to ${parameters.end}`,
          expectedResult: "Create this Google Calendar event through Tool Hub after approval.",
          status: "pending",
        },
        message: "I prepared that calendar event. Approve it and I will create it.",
        activity: "I requested approval for calendar.create",
      };
    }
  } else if (tool?.name === "read_google_sheet") {
    const parameters = parseSheetReadRequest(message);
    if (!parameters) {
      response = {
        tool,
        message: "I can read connected Google Sheets through Tool Hub. Send me a sheetId and range, for example: read sheetId abc123 range Sheet1!A1:D20.",
        activity: "I requested Google Sheets read details",
      };
    } else {
      const toolHubResponse = await callToolHub({
        tool: "sheets.read",
        parameters,
        user: user.email ?? "cody",
      });
      response = {
        tool,
        message: toolHubResponse.success
          ? formatSheetReadResult(toolHubResponse.data)
          : `I tried to read Google Sheets, but Tool Hub returned: ${toolHubResponse.error || "Unexpected Tool Hub response"}`,
        activity: toolHubResponse.success ? "I read a Google Sheet range" : "I encountered a Google Sheets Tool Hub error",
      };
    }
  } else if (tool?.name === "write_google_sheet") {
    response = {
      tool,
      message: "I can write to Google Sheets only after approval. For now, send the sheetId, range, and values in a structured request so I can prepare it safely.",
      activity: "I requested Google Sheets write details",
    };
  } else if (tool?.name === "todoist.create") {
    const parameters = parseTodoistCreateRequest(message);
    if (!parameters) {
      response = {
        tool,
        message: "Tell me the task you want me to add to Todoist. For example: add task Follow up with Drew tomorrow.",
        activity: "I requested Todoist task details",
      };
    } else {
      toolInputSummary = { request: message, parameters };
      response = {
        tool,
        approval: {
          action: tool.approvalAction ?? "Create Todoist task",
          target: parameters.task,
          expectedResult: `Create a Todoist task${parameters.due ? ` due ${parameters.due}` : ""}.`,
          status: "pending",
        },
        message: "I prepared that Todoist task. Approve it and I will create it.",
        activity: "I requested approval for todoist.create",
      };
    }
  } else if (tool?.name === "create_codex_task") {
    const codexPackage = createCodexPromptPackage(message);
    if (!codexPackage) {
      response = {
        tool,
        message: "Tell me what you want Codex to build or fix. For example: create a Codex task to add Google Calendar read access to Ava.",
        activity: "I requested Codex task details",
      };
    } else {
      toolInputSummary = { request: message, codexPackage };
      response = {
        tool,
        approval: {
          action: tool.approvalAction ?? "Queue Codex prompt",
          target: codexApprovalTarget(codexPackage),
          expectedResult: "Queue this prompt for the local Codex runner on Cody's Mac.",
          status: "pending",
        },
        message: `${formatCodexPromptPackage(codexPackage)}\n\nApprove this and I will queue it for the local Codex runner.`,
        activity: "I requested approval for create_codex_task",
      };
    }
  } else if (tool?.name === "send_slack_message") {
    const parameters = parseSlackSendRequest(message);
    if (!parameters) {
      response = {
        tool,
        message: "I can send approved Slack messages. Tell me the channel and message, for example: send Slack message to #team saying I am reviewing this now.",
        activity: "I requested Slack send details",
      };
    } else {
      toolInputSummary = { request: message, parameters, toolHubTool: "slack.send" };
      response = {
        tool,
        approval: {
          action: tool.approvalAction ?? "Send Slack message",
          target: `${parameters.channel} · ${parameters.message.slice(0, 80)}`,
          expectedResult: "Send this Slack message through Tool Hub after approval.",
          status: "pending",
        },
        message: "I prepared that Slack message. Approve it and I will send it.",
        activity: "I requested approval for slack.send",
      };
    }
  } else if (tool?.name === "send_sms") {
    const parameters = parseSmsSendRequest(message);
    if (!parameters) {
      response = {
        tool,
        message: "I can send approved SMS messages through Twilio. Tell me the phone number and message text.",
        activity: "I requested SMS send details",
      };
    } else {
      toolInputSummary = { request: message, parameters, toolHubTool: "sms.send" };
      response = {
        tool,
        approval: {
          action: tool.approvalAction ?? "Send SMS message",
          target: `${parameters.to} · ${parameters.message.slice(0, 80)}`,
          expectedResult: "Send this SMS through Tool Hub after approval.",
          status: "pending",
        },
        message: "I prepared that SMS message. Approve it and I will send it.",
        activity: "I requested approval for sms.send",
      };
    }
  } else if (tool && tool.status === "credential_needed") {
    response = {
      tool,
      message: `${tool.description} I still need the ${tool.integration} credential before I can use this capability.`,
      activity: `I identified a credential requirement for ${tool.integration}`,
    };
  } else if (tool && !toolCanRunWithoutApproval(tool)) {
    response = {
      tool,
      approval: approvalForTool(tool, message),
      message: "This action requires approval. I prepared the request and did not execute anything.",
      activity: `I requested approval for ${tool.name}`,
    };
  } else if (tool) {
    response = {
      tool,
      message: `${tool.description} I have the Phase 1 tool contract ready; the implementation handler is the next integration step.`,
      activity: `I routed request to ${tool.name}`,
    };
  } else if (openAIConfigured()) {
    try {
      const modelResponse = await askOpenAI({
        message,
        history: conversationHistory ?? [],
        tools: JARVIS_TOOLS,
        dashboardContext,
        trendContext,
      });
      if (modelResponse) {
        response = {
          message: modelResponse,
          activity: "I answered with OpenAI reasoning",
        };
      }
    } catch (error) {
      console.error("Ava OpenAI request failed", error);
      response = {
        message: "My OpenAI reasoning connection encountered an error. The deterministic monitoring and approval systems remain online.",
        activity: "I encountered an OpenAI reasoning error",
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
      metadata: {
        dashboardPath,
        dashboardContext: {
          pageLabel: dashboardContext.pageLabel,
          taskSummary: dashboardContext.taskSummary,
          automationSummary: dashboardContext.automationSummary,
        },
      },
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
      input_summary: toolInputSummary,
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
        dashboardPath,
      },
    });
    await supabase.from("jarvis_conversations").update({ updated_at: new Date().toISOString() }).eq("conversation_id", conversationId);
    response.conversationId = conversationId;
  }

  return NextResponse.json({
    ...response,
    dashboardContext,
    trendContext,
    capabilitySummary: dashboardContext.capabilitySummary,
  });
}
