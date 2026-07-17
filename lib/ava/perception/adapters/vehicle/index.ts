import { createPlaceholderSensorAdapter } from "@/lib/ava/perception/adapters/placeholder";

export function createVehiclePlaceholderAdapter() {
  return createPlaceholderSensorAdapter({
    id: "vehicle",
    label: "Vehicle",
    sourceType: "vehicle",
    supportedEntityTypes: ["vehicle", "sensor"],
    capabilities: [
      { id: "vehicle-state-readiness", label: "Vehicle State Readiness", description: "Placeholder for future vehicle telemetry observations." },
    ],
    placeholderObservation: {
      type: "sensor_reading",
      entityType: "vehicle",
      entityId: "vehicle-placeholder",
      summary: "Vehicle perception placeholder is ready.",
      value: { connected: false },
    },
  });
}
