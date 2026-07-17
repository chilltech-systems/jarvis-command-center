import type { AvaEvent, AvaWorldEntity, AvaWorldModel, AvaEntityHealth } from "@/lib/ava/core/types";
import { severityWeight } from "@/lib/ava/core/timeline";
import { canonicalEntityId } from "@/lib/ava/core/entities";

function healthFromEvents(events: AvaEvent[]): AvaEntityHealth {
  const highest = events.reduce((score, event) => Math.max(score, severityWeight(event.severity)), 0);
  if (highest >= 5) return "critical";
  if (highest >= 4) return "at_risk";
  if (highest >= 3) return "watch";
  if (highest > 0) return "healthy";

  return "unknown";
}

export function buildWorldModel(events: AvaEvent[], generatedAt = new Date().toISOString()): AvaWorldModel {
  const grouped = new Map<string, AvaEvent[]>();

  for (const event of events) {
    const key = `${event.entityType}:${event.entityId}`;
    grouped.set(key, [...(grouped.get(key) || []), event]);
  }

  const entities: AvaWorldEntity[] = Array.from(grouped.entries()).map(([id, entityEvents]) => {
    const latest = [...entityEvents].sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp))[0];
    const activeAlerts = entityEvents.filter((event) => ["critical", "urgent", "warning"].includes(event.severity));

    return {
      id,
      canonicalId: canonicalEntityId(latest.entityType, latest.source, latest.entityId),
      type: latest.entityType,
      name: latest.entityId,
      currentState: latest.summary,
      health: healthFromEvents(entityEvents),
      priority: entityEvents.reduce((total, event) => total + severityWeight(event.severity), 0),
      relationships: latest.relatedEntities,
      lastUpdated: latest.timestamp,
      activeAlerts,
      payload: latest.payload,
    };
  });

  return {
    generatedAt,
    entities,
    entityIndex: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
  };
}
