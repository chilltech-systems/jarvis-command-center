import { storeAvaChanges, storeAvaEvents, storeAvaSnapshot } from "@/lib/ava/core/memory";
import { createSecondBrainMemory, writeSecondBrainMemory } from "@/lib/ava/core/second-brain-memory";
import type { AvaRuntimeCognitionResult, AvaRuntimeConfig, AvaRuntimeMemoryFlushResult } from "@/lib/ava/runtime/types";
import type { AvaSupabaseLike } from "@/lib/ava/core/types";

export async function persistAvaRuntimeMemory({
  result,
  config,
  supabase,
  ownerId,
}: {
  result: AvaRuntimeCognitionResult | null;
  config: AvaRuntimeConfig;
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
}): Promise<AvaRuntimeMemoryFlushResult> {
  const enabled = config.memoryPersistenceEnabled && config.featureFlags.memoryPersistence;

  if (!enabled) {
    return {
      enabled,
      attempted: false,
      persistedSnapshot: false,
      persistedChanges: 0,
      persistedEvents: 0,
      persistedMemories: 0,
      reason: "Runtime memory persistence is disabled.",
    };
  }

  if (!result) {
    return {
      enabled,
      attempted: false,
      persistedSnapshot: false,
      persistedChanges: 0,
      persistedEvents: 0,
      persistedMemories: 0,
      reason: "No cognition result is available to persist.",
    };
  }

  if (!supabase || !ownerId) {
    return {
      enabled,
      attempted: false,
      persistedSnapshot: false,
      persistedChanges: 0,
      persistedEvents: 0,
      persistedMemories: 0,
      reason: "Supabase client or owner id was not provided.",
    };
  }

  const meaningfulChanges = result.detectedChanges.filter((change) =>
    change.visibility === "user" && ["Important", "Critical"].includes(change.classification),
  );
  const shouldPersistSnapshot = !result.previousSnapshot || meaningfulChanges.length > 0;
  if (!shouldPersistSnapshot) {
    return {
      enabled,
      attempted: false,
      persistedSnapshot: false,
      persistedChanges: 0,
      persistedEvents: 0,
      persistedMemories: 0,
      reason: "No meaningful changes were detected.",
    };
  }

  await storeAvaSnapshot({ supabase, ownerId, snapshot: result.currentSnapshot });
  const changeResults = await storeAvaChanges({ supabase, ownerId, changes: meaningfulChanges });
  const meaningfulChangeIds = new Set(meaningfulChanges.map((change) => change.id));
  const eventResults = await storeAvaEvents({
    supabase,
    ownerId,
    events: result.changeEvents.filter((event) => meaningfulChangeIds.has(event.entityId)),
  });
  const memoryResults = await Promise.all(meaningfulChanges.map((change) => writeSecondBrainMemory({
    supabase,
    ownerId,
    memory: createSecondBrainMemory({
      id: `change:${change.id}`,
      kind: "episode",
      summary: change.summary,
      sourceReferences: [{ source: change.category, referenceId: change.id, observedAt: change.timestamp }],
      observedAt: change.timestamp,
      confidence: change.confidence,
      status: "active",
      relatedEntities: [{ ...change.affectedEntity, relationship: "affected" }],
      content: {
        type: change.type,
        classification: change.classification,
        previousValue: change.previousValue,
        currentValue: change.currentValue,
        recommendedAction: change.recommendedAction,
      },
    }),
  })));

  return {
    enabled,
    attempted: true,
    persistedSnapshot: true,
    persistedChanges: changeResults.filter((item) => item.stored).length,
    persistedEvents: eventResults.filter((item) => item.stored).length,
    persistedMemories: memoryResults.filter((item) => item.stored).length,
    reason: null,
  };
}
