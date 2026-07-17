import { storeAvaChanges, storeAvaEvents, storeAvaSnapshot } from "@/lib/ava/core/memory";
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
      reason: "Supabase client or owner id was not provided.",
    };
  }

  await storeAvaSnapshot({ supabase, ownerId, snapshot: result.currentSnapshot });
  const changeResults = await storeAvaChanges({ supabase, ownerId, changes: result.detectedChanges });
  const eventResults = await storeAvaEvents({ supabase, ownerId, events: result.changeEvents });

  return {
    enabled,
    attempted: true,
    persistedSnapshot: true,
    persistedChanges: changeResults.filter((item) => item.stored).length,
    persistedEvents: eventResults.filter((item) => item.stored).length,
    reason: null,
  };
}
