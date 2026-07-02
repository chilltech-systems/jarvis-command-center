import { buildAvaAwareness } from "@/lib/ava/core/awareness";
import { normalizeAwarenessEvents } from "@/lib/ava/core/events";
import { scoreTimelineAttention } from "@/lib/ava/core/attention";
import { mergeTimelineEvents, summarizeTimeline } from "@/lib/ava/core/timeline";
import { buildWorldModel } from "@/lib/ava/core/world";
import { reasonAboutAvaState } from "@/lib/ava/core/reasoning";
import type { AvaCognitiveState, AvaEvent } from "@/lib/ava/core/types";

export async function buildAvaCognitiveState(previousEvents: AvaEvent[] = []): Promise<AvaCognitiveState> {
  const generatedAt = new Date().toISOString();
  const awareness = await buildAvaAwareness();
  const events = normalizeAwarenessEvents(awareness);
  const timeline = mergeTimelineEvents(events);
  const timelineSummary = summarizeTimeline(timeline);
  const world = buildWorldModel(timeline, generatedAt);
  const attention = scoreTimelineAttention(timeline);
  const reasoning = reasonAboutAvaState({ events: timeline, attention, world, previousEvents });

  return {
    generatedAt,
    awareness,
    events,
    timeline,
    timelineSummary,
    world,
    attention,
    reasoning,
  };
}
