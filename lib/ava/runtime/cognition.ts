import { changeToEvent } from "@/lib/ava/core/changes";
import { diffAvaSnapshots } from "@/lib/ava/core/diff";
import { getAvaExecutiveContext } from "@/lib/ava/core/executive-context";
import { buildAvaSnapshot } from "@/lib/ava/core/snapshot";
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
  const executiveContext = await getAvaExecutiveContext({ previousSnapshot });

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
