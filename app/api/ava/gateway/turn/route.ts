import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseGatewayJson, requireAvaGateway } from "@/lib/ava/gateway/auth";
import { AVA_CAPABILITIES } from "@/lib/ava/gateway/capabilities";
import { compileAvaContext } from "@/lib/ava/gateway/context";
import { buildAvaRealtimeInstructions } from "@/lib/ava/gateway/instructions";
import { getAvaConversationMessages, recordAvaMessage } from "@/lib/ava/gateway/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAvaGateway(request);
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = parseGatewayJson(auth.bodyText);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const role = body.role === "assistant" ? "assistant" : body.role === "tool" ? "tool" : "user";
  const modality = body.modality === "voice" ? "voice" : "text";
  if (!conversationId || !content) return NextResponse.json({ error: "conversationId and content are required." }, { status: 400 });
  try {
    const supabase = createAdminClient();
    const { data: conversation } = await supabase.from("jarvis_conversations").select("conversation_id").eq("conversation_id", conversationId).eq("owner_id", auth.identity.ownerId).eq("status", "active").maybeSingle();
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const message = await recordAvaMessage({ supabase, ownerId: auth.identity.ownerId, conversationId, role, content, metadata: { interface: "nebula", modality, realtimeItemId: typeof body.realtimeItemId === "string" ? body.realtimeItemId : null } });
    const messages = await getAvaConversationMessages({ supabase, ownerId: auth.identity.ownerId, conversationId, limit: 20 });
    const context = await compileAvaContext({ supabase, ownerId: auth.identity.ownerId, ownerEmail: auth.identity.email, conversationId, messages, capabilities: AVA_CAPABILITIES, query: content });
    return NextResponse.json({ messageId: message?.message_id ?? null, context, instructions: buildAvaRealtimeInstructions(context) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ava turn failed." }, { status: 500 });
  }
}
