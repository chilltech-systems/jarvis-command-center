import { NextResponse } from "next/server";
import { getAvaDailyContext } from "@/lib/ava/daily-context";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const { authorized, supabase, user } = await requireJarvisAdmin();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: responseHeaders });
  return NextResponse.json(await getAvaDailyContext({ supabase, ownerId: user.id }), { headers: responseHeaders });
}
