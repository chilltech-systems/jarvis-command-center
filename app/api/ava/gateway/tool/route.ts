import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseGatewayJson, requireAvaGateway } from "@/lib/ava/gateway/auth";
import { resolveAvaApproval } from "@/lib/ava/gateway/approvals";
import { runAvaCapability } from "@/lib/ava/gateway/capabilities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAvaGateway(request);
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = parseGatewayJson(auth.bodyText);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const callId = typeof body.callId === "string" ? body.callId.slice(0, 200) : "";
  const name = typeof body.name === "string" ? body.name : "";
  const parameters = body.parameters && typeof body.parameters === "object" ? body.parameters as Record<string, unknown> : {};
  if (!conversationId || !callId || !name) return NextResponse.json({ error: "conversationId, callId, and name are required." }, { status: 400 });
  try {
    const supabase = createAdminClient();
    const { data: conversation } = await supabase.from("jarvis_conversations").select("conversation_id").eq("conversation_id", conversationId).eq("owner_id", auth.identity.ownerId).eq("status", "active").maybeSingle();
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const result = name === "ava_approval_resolve"
      ? await resolveAvaApproval({ supabase, ownerId: auth.identity.ownerId, ownerEmail: auth.identity.email, conversationId, approvalId: typeof parameters.approval_id === "string" ? parameters.approval_id : "", decision: parameters.decision === "denied" ? "denied" : "approved", confirmationText: typeof parameters.confirmation_text === "string" ? parameters.confirmation_text : "", modality: parameters.modality === "voice" ? "voice" : "text" })
      : await runAvaCapability({ supabase, ownerId: auth.identity.ownerId, ownerEmail: auth.identity.email, conversationId, callId, name, parameters });
    return NextResponse.json(result, { status: result.status === "failed" ? 422 : result.status === "unavailable" ? 404 : 200, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ status: "failed", error: error instanceof Error ? error.message : "Ava tool failed." }, { status: 500 });
  }
}
