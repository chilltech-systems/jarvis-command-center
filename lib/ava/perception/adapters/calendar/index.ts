import { createPlaceholderSensorAdapter } from "@/lib/ava/perception/adapters/placeholder";

export function createCalendarPlaceholderAdapter() {
  return createPlaceholderSensorAdapter({
    id: "calendar",
    label: "Calendar",
    sourceType: "calendar",
    supportedEntityTypes: ["calendar", "event"],
    capabilities: [
      { id: "calendar-event-readiness", label: "Calendar Event Readiness", description: "Placeholder for future calendar observations." },
    ],
    placeholderObservation: {
      type: "entity_update",
      entityType: "calendar",
      entityId: "calendar-placeholder",
      summary: "Calendar perception placeholder is ready.",
      value: { connected: false },
    },
  });
}
