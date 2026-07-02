import { changeToEvent, summarizeChanges } from "@/lib/ava/core/changes";
import { diffAvaSnapshots } from "@/lib/ava/core/diff";
import { readLatestAvaSnapshot, storeAvaChanges, storeAvaSnapshot } from "@/lib/ava/core/memory";
import { buildAvaSnapshot, parseAvaSnapshot } from "@/lib/ava/core/snapshot";
import { buildAvaCognitiveState } from "@/lib/ava/core/state";
import type { AvaPerceptionResult, AvaSupabaseLike } from "@/lib/ava/core/types";

export async function perceiveAvaChanges({
  supabase,
  ownerId,
  previousSnapshot,
  store = true,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  previousSnapshot?: unknown;
  store?: boolean;
} = {}): Promise<AvaPerceptionResult> {
  const loadedPreviousSnapshot = previousSnapshot === undefined
    ? await readLatestAvaSnapshot({ supabase, ownerId })
    : previousSnapshot;
  const parsedPreviousSnapshot = parseAvaSnapshot(loadedPreviousSnapshot);
  const state = await buildAvaCognitiveState();
  const currentSnapshot = buildAvaSnapshot(state);
  const detectedChanges = diffAvaSnapshots(parsedPreviousSnapshot, currentSnapshot);
  const visibleChanges = detectedChanges.filter((change) => change.visibility === "user" && change.classification !== "Hidden");
  const changeEvents = detectedChanges.map(changeToEvent);
  const changeSummary = summarizeChanges(detectedChanges);

  if (store) {
    await storeAvaSnapshot({ supabase, ownerId, snapshot: currentSnapshot });
    await storeAvaChanges({ supabase, ownerId, changes: detectedChanges });
  }

  return {
    currentSnapshot,
    previousSnapshot: parsedPreviousSnapshot,
    detectedChanges,
    visibleChanges,
    changeEvents,
    changeSummary,
  };
}
