import type { AvaAttentionScore, AvaEvent, AvaPriority, AvaReasoningOutput, AvaWorldModel } from "@/lib/ava/core/types";

function priorityFromEvent(event: AvaEvent, attention: AvaAttentionScore): AvaPriority {
  return {
    id: event.id,
    title: event.summary,
    summary: `${event.category} signal from ${event.source}`,
    severity: event.severity,
    entityType: event.entityType,
    entityId: event.entityId,
    score: attention.score,
  };
}

export function reasonAboutAvaState({
  events,
  attention,
  world,
  previousEvents = [],
}: {
  events: AvaEvent[];
  attention: AvaAttentionScore[];
  world: AvaWorldModel;
  previousEvents?: AvaEvent[];
}): AvaReasoningOutput {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const scoredPriorities = attention
    .map((score) => {
      const event = eventById.get(score.eventId);
      return event ? priorityFromEvent(event, score) : null;
    })
    .filter((priority): priority is AvaPriority => Boolean(priority));
  const topPriorities = scoredPriorities.filter((priority) => priority.score >= 40).slice(0, 5);
  const openRisks = scoredPriorities.filter((priority) => ["critical", "urgent", "warning"].includes(priority.severity)).slice(0, 5);
  const pendingApprovals = scoredPriorities.filter((priority) => priority.entityType === "Approval" || priority.title.toLowerCase().includes("approval"));
  const previousIds = new Set(previousEvents.map((event) => event.id));
  const changesSinceLastSnapshot = events
    .filter((event) => !previousIds.has(event.id))
    .slice(0, 6)
    .map((event) => event.summary);
  const focusEntity = world.entities.sort((first, second) => second.priority - first.priority)[0];

  return {
    generatedAt: new Date().toISOString(),
    topPriorities,
    suggestedFocus: topPriorities[0]?.title || focusEntity?.currentState || "No urgent focus selected.",
    openRisks,
    changesSinceLastSnapshot,
    pendingApprovals,
  };
}
