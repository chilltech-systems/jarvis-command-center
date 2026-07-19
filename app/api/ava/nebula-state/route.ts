import { NextResponse, type NextRequest } from "next/server";
import { getAvaNebulaSnapshotV2 } from "@/lib/ava/nebula-feed";
import type { AvaSupabaseLike } from "@/lib/ava/core/types";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";
import { getAvaDailyContext, getAvaFallbackDailyContext } from "@/lib/ava/daily-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "private, no-store, max-age=0" };

function privateDevHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

export async function GET(request: NextRequest) {
  const { authorized, supabase, user } = await requireJarvisAdmin();
  const localPreview = process.env.VERCEL_ENV !== "production" && privateDevHost(request.nextUrl.hostname);
  if ((!authorized || !user) && !localPreview) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: responseHeaders });

  try {
    const dailyContext = authorized && user
      ? await getAvaDailyContext({ supabase, ownerId: user.id })
      : await getAvaFallbackDailyContext();
    const snapshot = await getAvaNebulaSnapshotV2({ context: dailyContext.context, supabase: authorized ? supabase as unknown as AvaSupabaseLike : null, ownerId: authorized ? user?.id : null });
    return NextResponse.json(snapshot, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: "Nebula state is temporarily unavailable." }, { status: 503, headers: responseHeaders });
  }
}
