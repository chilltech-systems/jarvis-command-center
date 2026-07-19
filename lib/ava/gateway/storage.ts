import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AvaConversationMessage = {
  message_id?: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

export async function ensureAvaConversation({
  supabase,
  ownerId,
  requestedConversationId,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  requestedConversationId?: string | null;
}) {
  if (requestedConversationId) {
    const { data } = await supabase
      .from("jarvis_conversations")
      .select("conversation_id,title,context,updated_at")
      .eq("conversation_id", requestedConversationId)
      .eq("owner_id", ownerId)
      .eq("status", "active")
      .maybeSingle();
    if (data) return data;
  }

  const { data: recent } = await supabase
    .from("jarvis_conversations")
    .select("conversation_id,title,context,updated_at")
    .eq("owner_id", ownerId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return recent;

  const { data, error } = await supabase
    .from("jarvis_conversations")
    .insert({ owner_id: ownerId, title: "AVA Nebula conversation", context: { interface: "nebula" } })
    .select("conversation_id,title,context,updated_at")
    .single();
  if (error || !data) throw new Error(`Unable to create Ava conversation: ${error?.message || "Unknown error"}`);
  return data;
}

export async function getAvaConversationMessages({
  supabase,
  ownerId,
  conversationId,
  limit = 20,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  conversationId: string;
  limit?: number;
}): Promise<AvaConversationMessage[]> {
  const { data } = await supabase
    .from("jarvis_messages")
    .select("message_id,role,content,metadata,created_at")
    .eq("conversation_id", conversationId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  return ((data || []) as AvaConversationMessage[]).reverse();
}

export async function recordAvaMessage({
  supabase,
  ownerId,
  conversationId,
  role,
  content,
  metadata = {},
}: {
  supabase: SupabaseClient;
  ownerId: string;
  conversationId: string;
  role: AvaConversationMessage["role"];
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const normalized = content.trim().slice(0, 12_000);
  if (!normalized) return null;
  const realtimeItemId = typeof metadata.realtimeItemId === "string" ? metadata.realtimeItemId : "";
  if (realtimeItemId) {
    const { data: existing } = await supabase.from("jarvis_messages")
      .select("message_id,created_at")
      .eq("conversation_id", conversationId)
      .eq("owner_id", ownerId)
      .contains("metadata", { realtimeItemId })
      .limit(1)
      .maybeSingle();
    if (existing) return existing;
  }
  const { data, error } = await supabase.from("jarvis_messages").insert({
    conversation_id: conversationId,
    owner_id: ownerId,
    role,
    content: normalized,
    metadata,
  }).select("message_id,created_at").single();
  if (error) throw new Error(`Unable to store Ava message: ${error.message}`);
  await supabase.from("jarvis_conversations").update({
    updated_at: new Date().toISOString(),
    ...(role === "user" ? { title: normalized.slice(0, 80) } : {}),
  }).eq("conversation_id", conversationId).eq("owner_id", ownerId);
  return data;
}

export async function clearAvaConversation({
  supabase,
  ownerId,
  conversationId,
}: {
  supabase: SupabaseClient;
  ownerId: string;
  conversationId: string;
}) {
  const { data: conversation } = await supabase
    .from("jarvis_conversations")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!conversation) return false;

  await supabase.from("jarvis_approvals").delete().eq("conversation_id", conversationId).eq("owner_id", ownerId);
  await supabase.from("jarvis_activity_log").delete().eq("conversation_id", conversationId).eq("owner_id", ownerId);
  await supabase.from("jarvis_tool_calls").delete().eq("conversation_id", conversationId).eq("owner_id", ownerId);
  await supabase.from("jarvis_messages").delete().eq("conversation_id", conversationId).eq("owner_id", ownerId);
  await supabase.from("jarvis_memory").delete()
    .eq("owner_id", ownerId)
    .eq("scope", "ava_working_memory")
    .like("memory_key", `conversation:${conversationId}:%`);
  await supabase.from("jarvis_conversations").delete().eq("conversation_id", conversationId).eq("owner_id", ownerId);
  return true;
}
