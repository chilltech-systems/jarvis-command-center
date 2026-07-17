import { createPlaceholderSensorAdapter } from "@/lib/ava/perception/adapters/placeholder";

export function createCameraPlaceholderAdapter() {
  return createPlaceholderSensorAdapter({
    id: "camera",
    label: "Camera",
    sourceType: "camera",
    supportedEntityTypes: ["camera", "media_stream"],
    capabilities: [
      { id: "media-event-readiness", label: "Media Event Readiness", description: "Placeholder for future camera motion and media observations." },
    ],
    placeholderObservation: {
      type: "media_event",
      entityType: "camera",
      entityId: "camera-placeholder",
      summary: "Camera perception placeholder is ready.",
      value: { connected: false },
    },
  });
}
