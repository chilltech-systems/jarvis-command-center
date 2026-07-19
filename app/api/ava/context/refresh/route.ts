import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshAvaDailyContext } from "@/lib/ava/daily-context";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "private, no-store, max-age=0" };

function tokenMatches(request: Request, expected: string | undefined) {
  if (!expected) return false;
  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supplied = Buffer.from(suppliedToken);
  const expectedBuffer = Buffer.from(expected);
  return supplied.length === expectedBuffer.length && supplied.length > 0 && timingSafeEqual(supplied, expectedBuffer);
}

export async function POST(request: Request) {
  const automatic = tokenMatches(request, process.env.AVA_CONTEXT_REFRESH_TOKEN);
  const body = await request.json().catch(() => ({}));

  if (automatic) {
    const admin = createAdminClient();
    const ownerId = process.env.AVA_CONTEXT_OWNER_ID;
    if (!ownerId) {
      return NextResponse.json({ error: "AVA_CONTEXT_OWNER_ID is not configured." }, { status: 503, headers: responseHeaders });
    }
    const result = await refreshAvaDailyContext({ supabase: admin, ownerId, kind: "automatic" });
    return NextResponse.json(result, { status: result.status === "failed" ? 503 : result.status === "blocked" ? 429 : 200, headers: responseHeaders });
  }

  const { authorized, user } = await requireJarvisAdmin();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: responseHeaders });
  const admin = createAdminClient();
  const approvalId = typeof body.approvalId === "string" ? body.approvalId : "";
  if (!approvalId) return NextResponse.json({ error: "An approved context refresh action is required." }, { status: 400, headers: responseHeaders });

  const { data: approval } = await admin
    .from("jarvis_approvals")
    .select("approval_id,status,action,target,expires_at")
    .eq("approval_id", approvalId)
    .eq("owner_id", user.id)
    .eq("status", "approved")
    .eq("action", "Refresh Ava daily context")
    .maybeSingle();
  const expired = approval?.expires_at && Date.parse(approval.expires_at) <= Date.now();
  if (!approval || expired) {
    return NextResponse.json({ error: "The context refresh approval is missing, expired, or already used." }, { status: 409, headers: responseHeaders });
  }

  const result = await refreshAvaDailyContext({ supabase: admin, ownerId: user.id, kind: "manual" });
  await admin.from("jarvis_approvals").update({
    status: result.status === "success" || result.status === "partial" ? "executed" : "failed",
  }).eq("approval_id", approvalId).eq("owner_id", user.id).eq("status", "approved");
  await admin.from("jarvis_activity_log").insert({
    owner_id: user.id,
    activity_type: "ava_context_refresh",
    summary: result.status === "blocked" ? `Ava context refresh blocked: ${result.reason}` : `Ava context refresh ${result.status}.`,
    status: result.status,
    metadata: { approval_id: approvalId, usage: result.context.usage },
  });

  return NextResponse.json(result, { status: result.status === "failed" ? 503 : result.status === "blocked" ? 429 : 200, headers: responseHeaders });
}
