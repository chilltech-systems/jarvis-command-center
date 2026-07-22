import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseGatewayJson, requireAvaGateway } from "@/lib/ava/gateway/auth";
import { avaCapabilityHealth, avaRealtimeTools, liveAvaCapabilities } from "@/lib/ava/gateway/capabilities";
import { compileAvaContext } from "@/lib/ava/gateway/context";
import { buildAvaRealtimeInstructions } from "@/lib/ava/gateway/instructions";
import { ensureAvaConversation, getAvaConversationMessages } from "@/lib/ava/gateway/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAvaGateway(request);
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = parseGatewayJson(auth.bodyText);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  try {
    const supabase = createAdminClient();
    const conversation = await ensureAvaConversation({ supabase, ownerId: auth.identity.ownerId, requestedConversationId: typeof body.conversationId === "string" ? body.conversationId : null });
    const messages = await getAvaConversationMessages({ supabase, ownerId: auth.identity.ownerId, conversationId: conversation.conversation_id, limit: 20 });
    const context = await compileAvaContext({ supabase, ownerId: auth.identity.ownerId, ownerEmail: auth.identity.email, conversationId: conversation.conversation_id, messages, capabilities: liveAvaCapabilities() });
    return NextResponse.json({ conversationId: conversation.conversation_id, context, instructions: buildAvaRealtimeInstructions(context), tools: avaRealtimeTools(), capabilities: liveAvaCapabilities(), capabilityHealth: avaCapabilityHealth(), messages }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ava session failed." }, { status: 500 });
  }
}
