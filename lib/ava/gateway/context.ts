import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvaDailyContext } from "@/lib/ava/daily-context";
import type { AvaContextEnvelope, AvaContextLayer } from "@/lib/ava/gateway/types";
import type { AvaConversationMessage } from "@/lib/ava/gateway/storage";
import { avaCapabilityHealth } from "@/lib/ava/gateway/capabilities";
import { dailySourceHealth } from "@/lib/ava/gateway/health";
import { getAvaExecutionBudget } from "@/lib/ava/gateway/execution-budget";

type MemoryRow = {
  scope: string;
  memory_key: string;
  content: unknown;
  confidence: number | null;
  source: string | null;
  updated_at: string;
};

function compact(value: unknown, max = 240) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function memorySummary(row: MemoryRow) {
  const content = row.content && typeof row.content === "object" ? row.content as Record<string, unknown> : {};
  const summary = compact(content.summary || content.content || content, 220);
  const confidence = typeof row.confidence === "number" ? ` confidence ${row.confidence.toFixed(2)}` : "";
  return `${row.scope}: ${summary}${confidence} (source ${row.source || "unknown"})`;
}

function messagesSummary(messages: AvaConversationMessage[]) {
  return messages.slice(-20).map((message) => `${message.role}: ${compact(message.content, 260)}`);
}

function queryTerms(query: string) {
  return new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
}

function relevance(text: string, terms: Set<string>) {
  if (!terms.size) return 0;
  const normalized = text.toLowerCase();
  let score = 0;
  for (const term of terms) if (normalized.includes(term)) score += 1;
  return score;
}

function layer(level: AvaContextLayer["level"], name: string, values: Array<string | null | undefined>) {
  return { level, name, summary: values.filter((value): value is string => Boolean(value?.trim())) } satisfies AvaContextLayer;
}

export async function compileAvaContext({
  supabase,
  ownerId,
  ownerEmail,
  conversationId,
  messages,
  capabilities,
  query = "",
}: {
  supabase: SupabaseClient;
  ownerId: string;
  ownerEmail: string;
  conversationId: string;
  messages: AvaConversationMessage[];
  capabilities: Array<{ name: string; permission: string; status: string }>;
  query?: string;
}): Promise<AvaContextEnvelope> {
  const [{ data: memories }, { data: approvals }, { data: recentTools }, daily] = await Promise.all([
    supabase.from("jarvis_memory")
      .select("scope,memory_key,content,confidence,source,updated_at")
      .eq("owner_id", ownerId)
      .eq("active", true)
      .in("scope", ["ava_working_memory", "ava_episode", "ava_fact", "ava_procedure", "ava_commitment", "ava_preference", "ava_feedback", "ava_entity", "ava_entity_relationship"])
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase.from("jarvis_approvals")
      .select("approval_id,action,target,expected_result,expires_at,created_at")
      .eq("owner_id", ownerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("jarvis_tool_calls")
      .select("tool_name,status,output_summary,completed_at,created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(8),
    getAvaDailyContext({ supabase, ownerId }),
  ]);

  const context = daily.context;
  const capabilityHealth = avaCapabilityHealth();
  const sources = dailySourceHealth(daily);
  const executionBudget = await getAvaExecutionBudget({ supabase, ownerId, usage: daily.usage });
  const cognitive = context.raw.cognitiveState;
  const memoryRows = (memories || []) as MemoryRow[];
  const terms = queryTerms(query);
  const byScope = (scopes: string[]) => memoryRows
    .filter((row) => scopes.includes(row.scope))
    .map((row) => ({ row, score: relevance(memorySummary(row), terms) }))
    .sort((a, b) => b.score - a.score || Date.parse(b.row.updated_at) - Date.parse(a.row.updated_at))
    .filter((item, index) => !terms.size || item.score > 0 || index < 3)
    .slice(0, 8)
    .map(({ row }) => memorySummary(row));
  const world = cognitive.world.entities.slice().sort((a, b) => {
    const score = relevance(`${a.type} ${a.name} ${a.currentState}`, terms) - relevance(`${b.type} ${b.name} ${b.currentState}`, terms);
    return score || b.priority - a.priority;
  }).slice(0, 8);
  const sourceLines = sources.map((source) => `${source.source}: ${source.status}, age ${source.ageMs ?? "unknown"}ms${source.lastError ? `, error ${source.lastError}` : ""}`);
  const approvalLines = (approvals || []).map((approval) => `${approval.action} for ${approval.target}; expires ${approval.expires_at || "not set"}`);
  const toolLines = (recentTools || []).map((tool) => `${tool.tool_name}: ${tool.status} - ${compact(tool.output_summary, 180)}`);

  const layers: AvaContextLayer[] = [
    layer(0, "Identity", [
      `You are Ava, Cody Hill's calm first-person interface to his private second brain. The authenticated owner is ${ownerEmail}.`,
      "Protect attention, explain uncertainty, never expose credentials, and distinguish knowing, recommending, approving, executing, and verifying.",
      "Only interrupt for critical risks, expiring approvals, or immediate commitments.",
    ]),
    layer(1, "Conversation", [
      `Conversation ${conversationId}. Voice and text are one continuous thread.`,
      ...messagesSummary(messages),
    ]),
    layer(2, "Working memory", [
      ...byScope(["ava_working_memory", "ava_commitment"]),
      context.focusItems.topPriorities[0]?.title ? `Current focus: ${context.focusItems.topPriorities[0].title}` : null,
    ]),
    layer(3, "Time and change", [
      `Current time: ${new Date().toISOString()}`,
      ...context.recentChanges.slice(0, 6).map((change) => `${change.classification}: ${change.summary}`),
      context.calendarSummary,
    ]),
    layer(4, "Situational awareness", [
      `Daily awareness snapshot: ${daily.freshness}; age ${daily.snapshotAgeMs}ms; generated ${daily.generatedAt}.`,
      context.personalSummary,
      context.businessSummary,
      context.automationSummary,
      context.weatherSummary,
      ...sourceLines.slice(0, 12),
    ]),
    layer(5, "World model", world.map((entity) => `${entity.type} ${entity.name}: ${entity.currentState}; health ${entity.health}; priority ${entity.priority}`)),
    layer(6, "Durable memory", byScope(["ava_fact", "ava_procedure", "ava_preference", "ava_episode", "ava_feedback", "ava_entity", "ava_entity_relationship"])),
    layer(7, "Reasoning and attention", [
      `Mission status: ${context.missionStatus}`,
      `Suggested focus: ${cognitive.reasoning.suggestedFocus}`,
      ...context.topPriorities.slice(0, 5).map((priority) => `Priority ${priority.score}: ${priority.title}`),
      ...context.activeRisks.slice(0, 5).map((risk) => `Risk ${risk.severity}: ${risk.title}`),
      ...context.recommendedActions.slice(0, 4).map((recommendation) => `Recommendation: ${recommendation.title} - ${recommendation.action}`),
      ...approvalLines,
    ]),
    layer(8, "Capabilities and outcomes", [
      ...capabilities.map((capability) => `${capability.name}: ${capability.permission}`),
      ...capabilityHealth.filter((item) => !item.available).slice(0, 8).map((item) => `${item.name}: unavailable - ${item.reason}`),
      `n8n context budget: ${executionBudget.remainingExecutions} of ${executionBudget.dailyLimit} executions remain; stop ${executionBudget.stopEngaged ? "engaged" : "clear"}.`,
      ...toolLines,
    ]),
  ];

  const criticalRisk = context.activeRisks.find((risk) => risk.severity === "critical");
  const expiringApproval = (approvals || []).find((approval) => approval.expires_at && Date.parse(approval.expires_at) - Date.now() < 60_000);
  const criticalNotice = criticalRisk?.title || (expiringApproval ? `Approval expiring: ${expiringApproval.action} for ${expiringApproval.target}` : null);
  const promptContext = layers
    .map((item) => `L${item.level} ${item.name}\n${item.summary.map((summary) => `- ${summary}`).join("\n")}`)
    .join("\n\n")
    .slice(0, 18_000);
  const revision = createHash("sha256").update(`${daily.generatedAt}:${conversationId}:${promptContext}`).digest("hex").slice(0, 20);

  return {
    schemaVersion: 1,
    revision,
    generatedAt: new Date().toISOString(),
    freshness: daily.freshness,
    sourceAgeMs: daily.snapshotAgeMs,
    criticalNotice,
    sources,
    capabilityHealth,
    executionBudget,
    layers,
    promptContext,
  };
}
