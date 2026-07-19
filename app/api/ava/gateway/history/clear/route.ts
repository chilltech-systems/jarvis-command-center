import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseGatewayJson, requireAvaGateway } from "@/lib/ava/gateway/auth";
import { clearAvaConversation, ensureAvaConversation } from "@/lib/ava/gateway/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAvaGateway(request);
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = parseGatewayJson(auth.bodyText);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  if (!conversationId) return NextResponse.json({ error: "conversationId is required." }, { status: 400 });
  try {
    const supabase = createAdminClient();
    const cleared = await clearAvaConversation({ supabase, ownerId: auth.identity.ownerId, conversationId });
    if (!cleared) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const next = await ensureAvaConversation({ supabase, ownerId: auth.identity.ownerId });
    return NextResponse.json({ cleared: true, conversationId: next.conversation_id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to clear history." }, { status: 500 });
  }
}
