import type { AvaCoreJson } from "@/lib/ava/core/types";

export type AvaObservationType =
  | "state_change"
  | "sensor_reading"
  | "entity_update"
  | "alert"
  | "media_event"
  | "presence_event"
  | "automation_event"
  | "environmental_reading";

export type AvaObservationSeverity = "info" | "normal" | "warning" | "critical";

export type AvaObservation = {
  id: string;
  type: AvaObservationType;
  sourceAdapter: string;
  sourceType: string;
  entityId: string | null;
  entityType: string | null;
  timestamp: string;
  severity: AvaObservationSeverity;
  summary: string;
  value: AvaCoreJson;
  metadata: Record<string, AvaCoreJson>;
};

export type AvaObservationInput = {
  id?: string;
  type: AvaObservationType;
  sourceAdapter: string;
  sourceType: string;
  entityId?: string | null;
  entityType?: string | null;
  timestamp?: string;
  severity?: AvaObservationSeverity;
  summary: string;
  value?: AvaCoreJson;
  metadata?: Record<string, AvaCoreJson>;
};

export type AvaObservationStats = {
  total: number;
  byAdapter: Record<string, number>;
  byType: Partial<Record<AvaObservationType, number>>;
  lastObservationAt: string | null;
};

export function createAvaObservation(input: AvaObservationInput): AvaObservation {
  const timestamp = input.timestamp || new Date().toISOString();
  const entityPart = input.entityId || "global";

  return {
    id: input.id || `${input.sourceAdapter}:${input.type}:${entityPart}:${timestamp}`,
    type: input.type,
    sourceAdapter: input.sourceAdapter,
    sourceType: input.sourceType,
    entityId: input.entityId || null,
    entityType: input.entityType || null,
    timestamp,
    severity: input.severity || "normal",
    summary: input.summary,
    value: input.value ?? {},
    metadata: input.metadata || {},
  };
}

export function summarizeObservations(observations: AvaObservation[]): AvaObservationStats {
  return observations.reduce<AvaObservationStats>((stats, observation) => {
    stats.total += 1;
    stats.byAdapter[observation.sourceAdapter] = (stats.byAdapter[observation.sourceAdapter] || 0) + 1;
    stats.byType[observation.type] = (stats.byType[observation.type] || 0) + 1;
    if (!stats.lastObservationAt || observation.timestamp > stats.lastObservationAt) {
      stats.lastObservationAt = observation.timestamp;
    }

    return stats;
  }, {
    total: 0,
    byAdapter: {},
    byType: {},
    lastObservationAt: null,
  });
}
