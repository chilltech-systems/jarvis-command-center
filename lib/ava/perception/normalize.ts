import { createAvaObservation, type AvaObservation } from "@/lib/ava/perception/observations";
import type { AvaPlaceholderAdapterOptions } from "@/lib/ava/perception/sensor";

export function normalizeAdapterPayload({
  adapterId,
  sourceType,
  payload,
}: {
  adapterId: string;
  sourceType: string;
  payload: unknown;
}): AvaObservation[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Partial<AvaObservation>;

  if (!record.type || !record.summary) return [];

  return [
    createAvaObservation({
      id: typeof record.id === "string" ? record.id : undefined,
      type: record.type,
      sourceAdapter: adapterId,
      sourceType,
      entityId: typeof record.entityId === "string" ? record.entityId : null,
      entityType: typeof record.entityType === "string" ? record.entityType : null,
      timestamp: typeof record.timestamp === "string" ? record.timestamp : undefined,
      severity: record.severity,
      summary: String(record.summary),
      value: record.value,
      metadata: record.metadata,
    }),
  ];
}

export function placeholderObservationPayload(options: AvaPlaceholderAdapterOptions) {
  if (!options.placeholderObservation) return [];

  return [{
    type: options.placeholderObservation.type,
    entityType: options.placeholderObservation.entityType,
    entityId: options.placeholderObservation.entityId,
    summary: options.placeholderObservation.summary,
    value: options.placeholderObservation.value || {},
    metadata: {
      placeholder: true,
      supportedEntityTypes: options.supportedEntityTypes || [],
      ...options.placeholderObservation.metadata,
    },
  }];
}
