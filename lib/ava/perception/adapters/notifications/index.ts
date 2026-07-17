import { createPlaceholderSensorAdapter } from "@/lib/ava/perception/adapters/placeholder";

export function createNotificationsPlaceholderAdapter() {
  return createPlaceholderSensorAdapter({
    id: "notifications",
    label: "Notifications",
    sourceType: "notifications",
    supportedEntityTypes: ["notification", "alert"],
    capabilities: [
      { id: "notification-event-readiness", label: "Notification Event Readiness", description: "Placeholder for future notification observations." },
    ],
    placeholderObservation: {
      type: "alert",
      entityType: "notification",
      entityId: "notifications-placeholder",
      summary: "Notification perception placeholder is ready.",
      value: { connected: false },
    },
  });
}
