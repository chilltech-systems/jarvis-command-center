import { NextResponse } from "next/server";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";

export async function POST() {
  const { authorized, supabase, user } = await requireJarvisAdmin();
  if (!authorized || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: toolCall, error: toolError } = await supabase.from("jarvis_tool_calls").insert({
    owner_id: user.id,
    tool_name: "ava.context.refresh_override",
    permission_level: "requires_approval",
    status: "approval_required",
    input_summary: { reason: "Manual daily context refresh override" },
  }).select("tool_call_id").single();
  if (toolError || !toolCall) return NextResponse.json({ error: toolError?.message || "Unable to create context refresh request." }, { status: 500 });

  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const { data: approval, error: approvalError } = await supabase.from("jarvis_approvals").insert({
    owner_id: user.id,
    tool_call_id: toolCall.tool_call_id,
    action: "Refresh Ava daily context",
    target: "Ava daily context snapshot",
    expected_result: "Gather a new context snapshot within the remaining daily n8n budget.",
    status: "pending",
    expires_at: expiresAt,
  }).select("approval_id,status,expires_at").single();
  if (approvalError || !approval) return NextResponse.json({ error: approvalError?.message || "Unable to create context refresh approval." }, { status: 500 });

  return NextResponse.json(approval, { status: 201 });
}
