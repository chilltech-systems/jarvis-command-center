import type { AvaRuntimeEntityType } from "@/lib/ava/runtime/types";
import type { AvaCoreJson } from "@/lib/ava/core/types";
import type { AvaObservation } from "@/lib/ava/perception/observations";

function runtimeEntityType(entityType: string | null): AvaRuntimeEntityType | null {
  if (!entityType) return null;
  const normalized = entityType.toLowerCase();
  if (normalized.includes("person")) return "person";
  if (normalized.includes("room")) return "room";
  if (normalized.includes("device") || normalized.includes("sensor") || normalized.includes("camera") || normalized.includes("microphone")) return "device";
  if (normalized.includes("vehicle")) return "vehicle";
  if (normalized.includes("pet")) return "pet";
  if (normalized.includes("project")) return "project";
  if (normalized.includes("automation")) return "automation";
  if (normalized.includes("calendar")) return "calendar";
  return null;
}

export async function routeAvaObservation({
  observation,
  runtime,
}: {
  observation: AvaObservation;
  runtime: {
    eventBus: {
      publish: (event: {
        type: string;
        priority?: "critical" | "high" | "normal" | "low";
        source: string;
        origin: string;
        payload: Record<string, AvaCoreJson>;
      }) => Promise<unknown>;
    };
    entities: {
      registerEntity: (entity: {
        id: string;
        type: AvaRuntimeEntityType;
        name: string;
        aliases?: string[];
        metadata?: Record<string, any>;
      }) => unknown;
    };
    context: {
      setContext: (patch: Record<string, unknown>) => unknown;
    };
    store: {
      setPartialState: (patch: Record<string, unknown>) => unknown;
      getState: () => { latestObservations?: AvaObservation[] };
    };
  };
}) {
  const entityType = runtimeEntityType(observation.entityType);
  const currentObservations = runtime.store.getState().latestObservations || [];

  runtime.store.setPartialState({
    latestObservations: [observation, ...currentObservations].slice(0, 100),
  });

  if (entityType && observation.entityId) {
    runtime.entities.registerEntity({
      id: observation.entityId,
      type: entityType,
      name: observation.entityId,
      metadata: {
        sourceAdapter: observation.sourceAdapter,
        sourceType: observation.sourceType,
        lastObservationAt: observation.timestamp,
        ...observation.metadata,
      },
    });
  }

  if (observation.severity === "warning" || observation.severity === "critical") {
    runtime.context.setContext({
      currentFocus: observation.summary,
    });
  }

  await runtime.eventBus.publish({
    type: "perception.observation.received",
    priority: observation.severity === "critical" ? "critical" : observation.severity === "warning" ? "high" : "normal",
    source: "ava-perception",
    origin: observation.sourceAdapter,
    payload: {
      observationId: observation.id,
      observationType: observation.type,
        sourceAdapter: observation.sourceAdapter,
        entityId: observation.entityId,
        severity: observation.severity,
        summary: observation.summary,
    },
  });
}
