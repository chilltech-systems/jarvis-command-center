import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AVA_CONTEXT_DAILY_LIMIT, type AvaContextUsage } from "@/lib/ava/daily-context";
import type { AvaExecutionBudget } from "@/lib/ava/gateway/types";
import { getCentralDayWindow, formatCentralDateKey } from "@/lib/ava/time";

type ToolCallRow = {
  status: string;
  input_summary: Record<string, unknown> | null;
};

export async function getAvaExecutionBudget({
  supabase,
  ownerId,
  usage,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  ownerId: string;
  usage: AvaContextUsage;
  now?: Date;
}): Promise<AvaExecutionBudget> {
  const { since, until } = getCentralDayWindow(now);
  const [{ data: toolCalls }, { data: overview }] = await Promise.all([
    supabase.from("jarvis_tool_calls")
      .select("status,input_summary")
      .eq("owner_id", ownerId)
      .gte("created_at", since)
      .lt("created_at", until),
    supabase.from("jarvis_hud_overview").select("executions_today").limit(1).maybeSingle(),
  ]);

  let explicitRead = 0;
  let approvedAction = 0;
  for (const row of (toolCalls || []) as ToolCallRow[]) {
    if (row.status !== "complete") continue;
    const category = row.input_summary?.n8nExecutionCategory;
    if (category === "explicit_read" && row.input_summary?.cacheHit !== true) explicitRead += 1;
    if (category === "approved_action") approvedAction += 1;
  }
  const retry = Math.max(0, usage.automaticAttempts - 1) * 3;
  const scheduledContext = Math.max(0, usage.reservedExecutions - retry);
  const monitoring = 0;
  const total = Number(overview?.executions_today || 0);
  const attributed = scheduledContext + retry + explicitRead + approvedAction + monitoring;

  return {
    centralDate: usage.centralDate || formatCentralDateKey(now),
    dailyLimit: AVA_CONTEXT_DAILY_LIMIT,
    reservedExecutions: usage.reservedExecutions,
    remainingExecutions: usage.remainingExecutions,
    stopEngaged: usage.stopEngaged,
    categories: {
      scheduledContext,
      retry,
      explicitRead,
      approvedAction,
      monitoring,
      unrelated: Math.max(0, total - attributed),
    },
  };
}
