import { createPlaceholderSensorAdapter } from "@/lib/ava/perception/adapters/placeholder";

export function createWeatherPlaceholderAdapter() {
  return createPlaceholderSensorAdapter({
    id: "weather",
    label: "Weather",
    sourceType: "weather",
    supportedEntityTypes: ["weather", "sensor"],
    capabilities: [
      { id: "environmental-reading-readiness", label: "Environmental Reading Readiness", description: "Placeholder for normalized weather and environmental observations." },
    ],
    placeholderObservation: {
      type: "environmental_reading",
      entityType: "weather",
      entityId: "weather-placeholder",
      summary: "Weather perception placeholder is ready.",
      value: { connected: false },
    },
  });
}
