import { createApplePlaceholderAdapter } from "@/lib/ava/perception/adapters/apple";
import { createCalendarPlaceholderAdapter } from "@/lib/ava/perception/adapters/calendar";
import { createCameraPlaceholderAdapter } from "@/lib/ava/perception/adapters/camera";
import { createHomeAssistantAdapter } from "@/lib/ava/perception/adapters/homeassistant";
import { createMicrophonePlaceholderAdapter } from "@/lib/ava/perception/adapters/microphone";
import { createNotificationsPlaceholderAdapter } from "@/lib/ava/perception/adapters/notifications";
import { createVehiclePlaceholderAdapter } from "@/lib/ava/perception/adapters/vehicle";
import { createWeatherPlaceholderAdapter } from "@/lib/ava/perception/adapters/weather";
import type { AvaSensorAdapter } from "@/lib/ava/perception/sensor";

export function createDefaultPerceptionAdapters(): AvaSensorAdapter[] {
  return [
    createHomeAssistantAdapter(),
    createCameraPlaceholderAdapter(),
    createWeatherPlaceholderAdapter(),
    createCalendarPlaceholderAdapter(),
    createVehiclePlaceholderAdapter(),
    createApplePlaceholderAdapter(),
    createMicrophonePlaceholderAdapter(),
    createNotificationsPlaceholderAdapter(),
  ];
}

export {
  createApplePlaceholderAdapter,
  createCalendarPlaceholderAdapter,
  createCameraPlaceholderAdapter,
  createHomeAssistantAdapter,
  createMicrophonePlaceholderAdapter,
  createNotificationsPlaceholderAdapter,
  createVehiclePlaceholderAdapter,
  createWeatherPlaceholderAdapter,
};
