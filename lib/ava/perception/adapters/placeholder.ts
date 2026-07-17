import { normalizeAdapterPayload, placeholderObservationPayload } from "@/lib/ava/perception/normalize";
import type {
  AvaPlaceholderAdapterOptions,
  AvaSensorAdapter,
  AvaSensorHealth,
  AvaSensorSubscriptionHandler,
} from "@/lib/ava/perception/sensor";

export function createPlaceholderSensorAdapter(options: AvaPlaceholderAdapterOptions): AvaSensorAdapter {
  let connected = false;
  const subscribers = new Set<AvaSensorSubscriptionHandler>();

  function health(): AvaSensorHealth {
    return {
      status: "healthy",
      message: "Placeholder adapter ready.",
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    id: options.id,
    label: options.label,
    sourceType: options.sourceType,
    enabled: true,
    initialize: () => undefined,
    connect: () => {
      connected = true;
    },
    disconnect: () => {
      connected = false;
    },
    health,
    capabilities: () => options.capabilities,
    poll: () => placeholderObservationPayload(options),
    subscribe: (handler) => {
      subscribers.add(handler);

      return () => {
        subscribers.delete(handler);
      };
    },
    normalize: (payload) => normalizeAdapterPayload({
      adapterId: options.id,
      sourceType: options.sourceType,
      payload,
    }),
  };
}
