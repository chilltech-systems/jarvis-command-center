import { NextResponse } from "next/server";
import { requireJarvisAdmin } from "@/lib/jarvis/auth";

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
    .select("approval_id, action, target, status")
    .single();

  if (error || !data) return NextResponse.json({ error: "Approval was not found or already decided" }, { status: 409 });

  await supabase.from("jarvis_activity_log").insert({
    owner_id: user.id,
    activity_type: "approval_decision",
    summary: `Jarvis action ${status}: ${data.action}`,
    status,
    metadata: { approval_id: approvalId, target: data.target },
  });

  return NextResponse.json(data);
}
