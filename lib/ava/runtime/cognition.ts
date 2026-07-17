import { changeToEvent } from "@/lib/ava/core/changes";
import { diffAvaSnapshots } from "@/lib/ava/core/diff";
import { buildAvaExecutiveContextFromState } from "@/lib/ava/core/executive-context";
import { readLatestAvaSnapshot } from "@/lib/ava/core/memory";
import { persistAvaRuntimeMemory } from "@/lib/ava/runtime/memory";
import { createAvaRuntimeConfig } from "@/lib/ava/runtime/config";
import type { AvaAwarenessDependencies } from "@/lib/ava/core/awareness";
import type { AvaSupabaseLike } from "@/lib/ava/core/types";
import { buildAvaSnapshot, parseAvaSnapshot } from "@/lib/ava/core/snapshot";
import { buildAvaCognitiveState } from "@/lib/ava/core/state";
import type {
  AvaRuntimeCognitionPipeline,
  AvaRuntimeCognitionResult,
} from "@/lib/ava/runtime/types";

export const runAvaRuntimeCognition: AvaRuntimeCognitionPipeline = async ({
  previousSnapshot = null,
}: {
  previousSnapshot?: AvaRuntimeCognitionResult["previousSnapshot"];
} = {}) => {
  const cognitiveState = await buildAvaCognitiveState();
  const currentSnapshot = buildAvaSnapshot(cognitiveState);
  const detectedChanges = diffAvaSnapshots(previousSnapshot, currentSnapshot);
  const visibleChanges = detectedChanges.filter((change) => change.visibility === "user" && change.classification !== "Hidden");
  const changeEvents = detectedChanges.map(changeToEvent);
  const executiveContext = buildAvaExecutiveContextFromState({ cognitiveState, previousSnapshot });

  return {
    generatedAt: new Date().toISOString(),
    cognitiveState: {
      awareness: cognitiveState.awareness,
      timeline: cognitiveState.timeline,
      world: cognitiveState.world,
      reasoning: cognitiveState.reasoning,
      attention: cognitiveState.attention,
    },
    executiveContext,
    currentSnapshot,
    previousSnapshot,
    detectedChanges,
    visibleChanges,
    changeEvents,
    recommendations: executiveContext.recommendedActions,
    focusPlan: executiveContext.focusItems,
    missionStatus: executiveContext.missionStatus,
  };
};

export async function runAvaRequestCognition({
  previousSnapshot,
  supabase,
  ownerId,
  awarenessDependencies,
  persist = true,
}: {
  previousSnapshot?: unknown;
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  awarenessDependencies?: Partial<AvaAwarenessDependencies>;
  persist?: boolean;
} = {}) {
  const loadedPreviousSnapshot = previousSnapshot === undefined
    ? await readLatestAvaSnapshot({ supabase, ownerId })
    : previousSnapshot;
  const cognitiveState = await buildAvaCognitiveState([], { awarenessDependencies });
  const currentSnapshot = buildAvaSnapshot(cognitiveState);
  const parsedPreviousSnapshot = parseAvaSnapshot(loadedPreviousSnapshot);
  const detectedChanges = diffAvaSnapshots(parsedPreviousSnapshot, currentSnapshot);
  const visibleChanges = detectedChanges.filter((change) => change.visibility === "user" && change.classification !== "Hidden");
  const changeEvents = detectedChanges.map(changeToEvent);
  const executiveContext = buildAvaExecutiveContextFromState({ cognitiveState, previousSnapshot: parsedPreviousSnapshot });
  const result: AvaRuntimeCognitionResult = {
    generatedAt: new Date().toISOString(),
    cognitiveState: {
      awareness: cognitiveState.awareness,
      timeline: cognitiveState.timeline,
      world: cognitiveState.world,
      reasoning: cognitiveState.reasoning,
      attention: cognitiveState.attention,
    },
    executiveContext,
    currentSnapshot,
    previousSnapshot: parsedPreviousSnapshot,
    detectedChanges,
    visibleChanges,
    changeEvents,
    recommendations: executiveContext.recommendedActions,
    focusPlan: executiveContext.focusItems,
    missionStatus: executiveContext.missionStatus,
  };
  const persistence = persist
    ? await persistAvaRuntimeMemory({
      result,
      config: createAvaRuntimeConfig({
        mode: "request",
        memoryPersistenceEnabled: true,
        featureFlags: { scheduler: false, memoryPersistence: true, perception: false },
      }),
      supabase,
      ownerId,
    })
    : null;

  return { result, persistence };
}
