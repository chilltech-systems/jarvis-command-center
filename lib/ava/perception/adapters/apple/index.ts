import { createPlaceholderSensorAdapter } from "@/lib/ava/perception/adapters/placeholder";

export function createApplePlaceholderAdapter() {
  return createPlaceholderSensorAdapter({
    id: "apple",
    label: "Apple Devices",
    sourceType: "apple",
    supportedEntityTypes: ["device", "presence", "health"],
    capabilities: [
      { id: "apple-device-readiness", label: "Apple Device Readiness", description: "Placeholder for future Apple device and health observations." },
    ],
    placeholderObservation: {
      type: "presence_event",
      entityType: "device",
      entityId: "apple-placeholder",
      summary: "Apple device perception placeholder is ready.",
      value: { connected: false },
    },
  });
}
