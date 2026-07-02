import type { AvaChange, AvaCoreJson, AvaCoreSnapshot, AvaEvent, AvaMemoryRecord, AvaSupabaseLike } from "@/lib/ava/core/types";

function centralDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function memoryRecord<TContent extends AvaCoreJson>(
  scope: AvaMemoryRecord<TContent>["scope"],
  memoryKey: string,
  content: TContent,
): AvaMemoryRecord<TContent> {
  return {
    scope,
    memoryKey,
    source: "ava-cognitive-core",
    confidence: 1,
    active: true,
    content,
  };
}

export function buildEventMemoryRecord(event: AvaEvent) {
  return memoryRecord("ava_core_event", event.id, event as unknown as AvaCoreJson);
}

export function buildDailySnapshotMemoryRecord(content: AvaCoreJson, date = new Date()) {
  return memoryRecord("ava_core_daily_snapshot", centralDateKey(date), content);
}

export function buildSnapshotMemoryRecord(snapshot: AvaCoreSnapshot) {
  return memoryRecord("ava_core_snapshot", "latest", snapshot as unknown as AvaCoreJson);
}

export function buildChangeMemoryRecord(change: AvaChange) {
  return memoryRecord("ava_core_change", change.id, change as unknown as AvaCoreJson);
}

export function buildNotableChangeMemoryRecord(key: string, content: AvaCoreJson) {
  return memoryRecord("ava_core_notable_change", key, content);
}

export async function storeAvaMemoryRecord({
  supabase,
  ownerId,
  record,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  record: AvaMemoryRecord;
}) {
  if (!supabase || !ownerId) return { stored: false, reason: "Supabase client or owner id was not provided." };

  await supabase.from("jarvis_memory").upsert({
    owner_id: ownerId,
    scope: record.scope,
    memory_key: record.memoryKey,
    source: record.source,
    confidence: record.confidence,
    active: record.active,
    content: record.content,
  }, { onConflict: "owner_id,scope,memory_key" });

  return { stored: true, reason: null };
}

export async function storeAvaEvents({
  supabase,
  ownerId,
  events,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  events: AvaEvent[];
}) {
  const results = [];

  for (const event of events) {
    results.push(await storeAvaMemoryRecord({
      supabase,
      ownerId,
      record: buildEventMemoryRecord(event),
    }));
  }

  return results;
}

export async function storeAvaSnapshot({
  supabase,
  ownerId,
  snapshot,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  snapshot: AvaCoreSnapshot;
}) {
  return storeAvaMemoryRecord({
    supabase,
    ownerId,
    record: buildSnapshotMemoryRecord(snapshot),
  });
}

export async function storeAvaChanges({
  supabase,
  ownerId,
  changes,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  changes: AvaChange[];
}) {
  const results = [];

  for (const change of changes) {
    results.push(await storeAvaMemoryRecord({
      supabase,
      ownerId,
      record: buildChangeMemoryRecord(change),
    }));
  }

  return results;
}

export async function readRecentAvaMemory({
  supabase,
  ownerId,
  scope,
  limit = 20,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  scope: AvaMemoryRecord["scope"];
  limit?: number;
}) {
  if (!supabase || !ownerId) return [];

  const query = supabase
    .from("jarvis_memory")
    .select("memory_key,content,updated_at")
    .eq("owner_id", ownerId)
    .eq("scope", scope)
    .order("updated_at", { ascending: false })
    .limit(limit);
  const { data } = await query;

  return data || [];
}

export async function readLatestAvaSnapshot({
  supabase,
  ownerId,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
}) {
  const records = await readRecentAvaMemory({
    supabase,
    ownerId,
    scope: "ava_core_snapshot",
    limit: 1,
  });
  const content = (records[0] as { content?: unknown } | undefined)?.content;

  return content || null;
}
