import { NextResponse } from "next/server";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";
import { getAvaDailyContext } from "@/lib/ava/daily-context";
import { avaCapabilityHealth } from "@/lib/ava/gateway/capabilities";
import { dailySourceHealth } from "@/lib/ava/gateway/health";
import { getAvaExecutionBudget } from "@/lib/ava/gateway/execution-budget";

export const dynamic = "force-dynamic";

export async function GET() {
  const { authorized, supabase, user } = await requireJarvisAdmin();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const daily = await getAvaDailyContext({ supabase, ownerId: user.id });
  const executionBudget = await getAvaExecutionBudget({ supabase, ownerId: user.id, usage: daily.usage });
  return NextResponse.json({
    generatedAt: daily.generatedAt,
    freshness: daily.freshness,
    snapshotAgeMs: daily.snapshotAgeMs,
    sources: dailySourceHealth(daily),
    capabilities: avaCapabilityHealth(),
    executionBudget,
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
