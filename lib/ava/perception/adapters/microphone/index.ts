import { createPlaceholderSensorAdapter } from "@/lib/ava/perception/adapters/placeholder";

export function createMicrophonePlaceholderAdapter() {
  return createPlaceholderSensorAdapter({
    id: "microphone",
    label: "Microphone",
    sourceType: "microphone",
    supportedEntityTypes: ["microphone", "audio"],
    capabilities: [
      { id: "audio-event-readiness", label: "Audio Event Readiness", description: "Placeholder for future microphone observations. No voice recognition or wake words." },
    ],
    placeholderObservation: {
      type: "media_event",
      entityType: "microphone",
      entityId: "microphone-placeholder",
      summary: "Microphone perception placeholder is ready.",
      value: { connected: false },
    },
  });
}
