import { routeAvaObservation } from "@/lib/ava/perception/router";
import { summarizeObservations, type AvaObservation, type AvaObservationStats } from "@/lib/ava/perception/observations";
import type {
  AvaSensorAdapter,
  AvaSensorAdapterDiagnostics,
  AvaSensorAdapterState,
  AvaSensorHealth,
} from "@/lib/ava/perception/sensor";

type AdapterRecord = {
  adapter: AvaSensorAdapter;
  state: AvaSensorAdapterState;
  health: AvaSensorHealth;
  observations: AvaObservation[];
  unsubscribe?: (() => void) | void;
};

function defaultHealth(status: AvaSensorHealth["status"], message: string | null): AvaSensorHealth {
  return {
    status,
    message,
    checkedAt: new Date().toISOString(),
  };
}

export function createAvaPerceptionManager() {
  const adapters = new Map<string, AdapterRecord>();

  function registerAdapter(adapter: AvaSensorAdapter) {
    adapters.set(adapter.id, {
      adapter,
      state: adapter.enabled ? "registered" : "disabled",
      health: defaultHealth(adapter.enabled ? "disconnected" : "disabled", null),
      observations: [],
    });

    return adapter;
  }

  function unregisterAdapter(adapterId: string) {
    const record = adapters.get(adapterId);
    if (record?.unsubscribe) record.unsubscribe();
    if (record) void record.adapter.disconnect();

    return adapters.delete(adapterId);
  }

  function enableAdapter(adapterId: string) {
    const record = adapters.get(adapterId);
    if (!record) return null;
    record.adapter.enabled = true;
    record.state = "registered";
    record.health = defaultHealth("disconnected", "Adapter enabled.");
    return record.adapter;
  }

  function disableAdapter(adapterId: string) {
    const record = adapters.get(adapterId);
    if (!record) return null;
    record.adapter.enabled = false;
    record.state = "disabled";
    record.health = defaultHealth("disabled", "Adapter disabled.");
    return record.adapter;
  }

  async function initializeAll() {
    for (const record of adapters.values()) {
      if (!record.adapter.enabled) continue;
      await record.adapter.initialize();
      record.state = "initialized";
      record.health = await record.adapter.health();
    }
  }

  async function connectAll() {
    for (const record of adapters.values()) {
      if (!record.adapter.enabled) continue;
      await record.adapter.connect();
      record.health = await record.adapter.health();
      record.state = record.health.status === "healthy" || record.health.status === "connecting" ? "connected" : "disconnected";
      record.unsubscribe = record.adapter.subscribe((observation) => {
        record.observations.unshift(observation);
        if (record.observations.length > 100) record.observations.pop();
      });
    }
  }

  async function disconnectAll() {
    for (const record of adapters.values()) {
      if (record.unsubscribe) record.unsubscribe();
      await record.adapter.disconnect();
      record.state = record.adapter.enabled ? "disconnected" : "disabled";
      record.health = await record.adapter.health();
    }
  }

  async function collectObservations() {
    const observations: AvaObservation[] = [];

    for (const record of adapters.values()) {
      if (!record.adapter.enabled || record.state === "disabled") continue;
      const payloads = await record.adapter.poll();

      for (const payload of payloads) {
        const normalized = await record.adapter.normalize(payload);
        record.observations.unshift(...normalized);
        observations.push(...normalized);
      }

      record.observations = record.observations.slice(0, 100);
      record.health = await record.adapter.health();
    }

    return observations;
  }

  async function publishObservations(runtime: Parameters<typeof routeAvaObservation>[0]["runtime"], observations: AvaObservation[]) {
    for (const observation of observations) {
      await routeAvaObservation({ runtime, observation });
    }
  }

  function getDiagnostics(): AvaSensorAdapterDiagnostics[] {
    return Array.from(adapters.values()).map((record) => ({
      id: record.adapter.id,
      label: record.adapter.label,
      sourceType: record.adapter.sourceType,
      enabled: record.adapter.enabled,
      state: record.state,
      health: record.health,
      capabilityCount: record.adapter.capabilities().length,
      observationCount: record.observations.length,
      lastObservationAt: record.observations[0]?.timestamp || null,
      connected: record.state === "connected",
    }));
  }

  function getObservationStats(): AvaObservationStats {
    return summarizeObservations(Array.from(adapters.values()).flatMap((record) => record.observations));
  }

  function getLastObservation() {
    return Array.from(adapters.values())
      .flatMap((record) => record.observations)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0] || null;
  }

  return {
    registerAdapter,
    unregisterAdapter,
    enableAdapter,
    disableAdapter,
    initializeAll,
    connectAll,
    disconnectAll,
    collectObservations,
    publishObservations,
    getDiagnostics,
    getObservationStats,
    getLastObservation,
    listAdapters: () => Array.from(adapters.values()).map((record) => record.adapter),
  };
}
