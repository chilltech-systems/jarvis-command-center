import { createAvaObservation, type AvaObservation, type AvaObservationSeverity, type AvaObservationType } from "@/lib/ava/perception/observations";
import type { AvaCoreJson } from "@/lib/ava/core/types";
import type {
  AvaSensorAdapter,
  AvaSensorCapability,
  AvaSensorHealth,
  AvaSensorSubscriptionHandler,
} from "@/lib/ava/perception/sensor";

type HomeAssistantConfig = {
  enabled: boolean;
  localUrl: string;
  websocketUrl: string;
  connectionMode: string;
  token: string;
};

type HomeAssistantState = {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
};

type HomeAssistantRegistryEntity = {
  entity_id?: string;
  area_id?: string | null;
  device_id?: string | null;
  platform?: string | null;
};

type HomeAssistantDevice = {
  id?: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  manufacturer?: string | null;
  model?: string | null;
};

type HomeAssistantArea = {
  area_id?: string;
  name?: string;
};

type HomeAssistantEventPayload = {
  event_type?: string;
  data?: {
    entity_id?: string;
    old_state?: HomeAssistantState | null;
    new_state?: HomeAssistantState | null;
  };
  time_fired?: string;
};

type QueuedPayload =
  | { kind: "bootstrap"; state: HomeAssistantState }
  | { kind: "state_changed"; event: HomeAssistantEventPayload };

type ConnectionState = "disconnected" | "initialized" | "connecting" | "connected" | "error" | "disabled";

const ADAPTER_ID = "homeassistant";
const SOURCE_TYPE = "homeassistant";
const MAX_QUEUE_SIZE = 500;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 60_000;

function readConfig(): HomeAssistantConfig {
  return {
    enabled: process.env.HOME_ASSISTANT_ENABLED !== "false",
    localUrl: process.env.HOME_ASSISTANT_LOCAL_URL || "",
    websocketUrl: process.env.HOME_ASSISTANT_WS_LOCAL || "",
    connectionMode: process.env.HOME_ASSISTANT_CONNECTION_MODE || "local",
    token: process.env.HOME_ASSISTANT_TOKEN || "",
  };
}

function validateConfig(config: HomeAssistantConfig) {
  const errors = [];
  if (!config.enabled) errors.push("HOME_ASSISTANT_ENABLED is false.");
  if (!config.localUrl) errors.push("HOME_ASSISTANT_LOCAL_URL is required.");
  if (!config.websocketUrl) errors.push("HOME_ASSISTANT_WS_LOCAL is required.");
  if (!config.connectionMode) errors.push("HOME_ASSISTANT_CONNECTION_MODE is required.");
  if (!config.token) errors.push("HOME_ASSISTANT_TOKEN is required.");
  if (config.localUrl && !/^https?:\/\//i.test(config.localUrl)) errors.push("HOME_ASSISTANT_LOCAL_URL must start with http:// or https://.");
  if (config.websocketUrl && !/^wss?:\/\//i.test(config.websocketUrl)) errors.push("HOME_ASSISTANT_WS_LOCAL must start with ws:// or wss://.");

  return errors;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asJsonRecord(value: Record<string, unknown>): Record<string, AvaCoreJson> {
  return JSON.parse(JSON.stringify(value)) as Record<string, AvaCoreJson>;
}

function domainFromEntityId(entityId: string) {
  return entityId.split(".")[0] || "unknown";
}

function friendlyName(state: HomeAssistantState) {
  return String(state.attributes?.friendly_name || state.entity_id);
}

function deviceClass(state: HomeAssistantState) {
  return typeof state.attributes?.device_class === "string" ? state.attributes.device_class : null;
}

function observationTypeFor(domain: string): AvaObservationType {
  if (domain === "automation") return "automation_event";
  if (domain === "binary_sensor") return "state_change";
  if (["sensor", "weather"].includes(domain)) return "sensor_reading";
  if (["camera", "media_player"].includes(domain)) return "media_event";
  if (["person", "device_tracker"].includes(domain)) return "presence_event";
  if (["alert", "persistent_notification"].includes(domain)) return "alert";
  return "entity_update";
}

function severityFor(state: HomeAssistantState): AvaObservationSeverity {
  const normalizedState = String(state.state || "").toLowerCase();
  const domain = domainFromEntityId(state.entity_id);
  const className = String(deviceClass(state) || "").toLowerCase();

  if (["unavailable", "unknown"].includes(normalizedState)) return "warning";
  if (domain === "alarm_control_panel" && ["triggered", "pending"].includes(normalizedState)) return "critical";
  if (domain === "binary_sensor" && ["smoke", "gas", "moisture", "safety"].includes(className) && normalizedState === "on") return "critical";
  if (domain === "lock" && normalizedState === "unlocked") return "warning";

  return "normal";
}

function stateSummary(state: HomeAssistantState, oldState?: HomeAssistantState | null) {
  const name = friendlyName(state);
  const domain = domainFromEntityId(state.entity_id).replaceAll("_", " ");
  if (oldState && oldState.state !== state.state) return `${name} changed from ${oldState.state} to ${state.state}.`;
  return `${name} ${domain} is ${state.state}.`;
}

function stateMetadata({
  state,
  oldState,
  registryEntity,
  device,
  area,
}: {
  state: HomeAssistantState;
  oldState?: HomeAssistantState | null;
  registryEntity?: HomeAssistantRegistryEntity;
  device?: HomeAssistantDevice;
  area?: HomeAssistantArea;
}) {
  return asJsonRecord({
    entity_id: state.entity_id,
    friendly_name: friendlyName(state),
    domain: domainFromEntityId(state.entity_id),
    device_class: deviceClass(state),
    area: area?.name || registryEntity?.area_id || device?.area_id || null,
    state: state.state,
    attributes: {
      unit_of_measurement: state.attributes?.unit_of_measurement || null,
      device_class: deviceClass(state),
      friendly_name: friendlyName(state),
    },
    last_changed: state.last_changed || null,
    last_updated: state.last_updated || null,
    previous_state: oldState?.state || null,
    device_id: registryEntity?.device_id || null,
    device_name: device?.name_by_user || device?.name || null,
  });
}

function stateValue(state: HomeAssistantState) {
  return JSON.parse(JSON.stringify({
    state: state.state,
    unit: state.attributes?.unit_of_measurement || null,
  })) as AvaCoreJson;
}

export function createHomeAssistantAdapter(): AvaSensorAdapter {
  let config = readConfig();
  let configErrors = validateConfig(config);
  let connectionState: ConnectionState = config.enabled ? "disconnected" : "disabled";
  let authenticated = false;
  let ws: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let reconnectCount = 0;
  let messageId = 1;
  let connectedAt: string | null = null;
  let lastEventReceivedAt: string | null = null;
  let lastSynchronizationAt: string | null = null;
  let lastError: string | null = configErrors[0] || null;
  let websocketLatencyMs: number | null = null;
  const queuedPayloads: QueuedPayload[] = [];
  const subscribers = new Set<AvaSensorSubscriptionHandler>();
  const states = new Map<string, HomeAssistantState>();
  const registryEntities = new Map<string, HomeAssistantRegistryEntity>();
  const devices = new Map<string, HomeAssistantDevice>();
  const areas = new Map<string, HomeAssistantArea>();
  const pendingMessages = new Map<number, (message: any) => void>();
  const recentEventTimes: number[] = [];

  function resetConfig() {
    config = readConfig();
    configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      connectionState = config.enabled ? "error" : "disabled";
      lastError = configErrors.join(" ");
      return false;
    }
    lastError = null;
    return true;
  }

  function queuePayload(payload: QueuedPayload) {
    queuedPayloads.unshift(payload);
    if (queuedPayloads.length > MAX_QUEUE_SIZE) queuedPayloads.pop();
  }

  function recordEventTime() {
    const now = Date.now();
    recentEventTimes.unshift(now);
    while (recentEventTimes.length > 0 && now - recentEventTimes[recentEventTimes.length - 1] > 60_000) {
      recentEventTimes.pop();
    }
  }

  async function rest<T>(path: string): Promise<T> {
    const response = await fetch(`${config.localUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error(`Home Assistant REST ${path} returned ${response.status}.`);
    return await response.json() as T;
  }

  async function bootstrapRest() {
    await rest<Record<string, unknown>>("/api/config");
    const nextStates = await rest<HomeAssistantState[]>("/api/states");
    states.clear();
    for (const state of nextStates) {
      if (!state.entity_id) continue;
      states.set(state.entity_id, state);
      queuePayload({ kind: "bootstrap", state });
    }
    lastSynchronizationAt = new Date().toISOString();
  }

  function sendWs(type: string, payload: Record<string, unknown> = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error("Home Assistant WebSocket is not open.");
    const id = messageId++;
    ws.send(JSON.stringify({ id, type, ...payload }));
    return id;
  }

  function requestWs<T>(type: string, payload: Record<string, unknown> = {}, timeoutMs = 10_000): Promise<T> {
    const id = sendWs(type, payload);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingMessages.delete(id);
        reject(new Error(`Home Assistant WebSocket request ${type} timed out.`));
      }, timeoutMs);
      pendingMessages.set(id, (message) => {
        clearTimeout(timeout);
        if (message.success === false) {
          reject(new Error(`Home Assistant WebSocket request ${type} failed.`));
          return;
        }
        resolve(message.result as T);
      });
    });
  }

  async function loadRegistries() {
    const [entityRows, deviceRows, areaRows] = await Promise.all([
      requestWs<HomeAssistantRegistryEntity[]>("config/entity_registry/list").catch(() => []),
      requestWs<HomeAssistantDevice[]>("config/device_registry/list").catch(() => []),
      requestWs<HomeAssistantArea[]>("config/area_registry/list").catch(() => []),
    ]);

    registryEntities.clear();
    for (const entity of entityRows) {
      if (entity.entity_id) registryEntities.set(entity.entity_id, entity);
    }
    devices.clear();
    for (const device of deviceRows) {
      if (device.id) devices.set(device.id, device);
    }
    areas.clear();
    for (const area of areaRows) {
      if (area.area_id) areas.set(area.area_id, area);
    }
  }

  function areaFor(state: HomeAssistantState) {
    const registryEntity = registryEntities.get(state.entity_id);
    const device = registryEntity?.device_id ? devices.get(registryEntity.device_id) : undefined;
    const areaId = registryEntity?.area_id || device?.area_id || undefined;
    const area = areaId ? areas.get(areaId) : undefined;
    return { registryEntity, device, area };
  }

  function normalizeState(state: HomeAssistantState, oldState?: HomeAssistantState | null): AvaObservation {
    const domain = domainFromEntityId(state.entity_id);
    const lookup = areaFor(state);
    return createAvaObservation({
      type: oldState ? "state_change" : observationTypeFor(domain),
      sourceAdapter: ADAPTER_ID,
      sourceType: SOURCE_TYPE,
      entityId: state.entity_id,
      entityType: domain,
      timestamp: state.last_updated || state.last_changed || new Date().toISOString(),
      severity: severityFor(state),
      summary: stateSummary(state, oldState),
      value: stateValue(state),
      metadata: stateMetadata({ state, oldState, ...lookup }),
    });
  }

  function notify(observation: AvaObservation) {
    for (const subscriber of subscribers) {
      void subscriber(observation);
    }
  }

  function cleanupSocket() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    for (const resolve of pendingMessages.values()) {
      resolve({ success: false, result: null });
    }
    pendingMessages.clear();
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try { ws.close(); } catch {}
    }
    ws = null;
    authenticated = false;
    connectedAt = null;
  }

  function scheduleReconnect() {
    if (!config.enabled || reconnectTimer) return;
    reconnectAttempts += 1;
    const delay = Math.min(1_000 * 2 ** Math.min(reconnectAttempts, 6), MAX_BACKOFF_MS);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  }

  async function connectSocket() {
    if (typeof WebSocket === "undefined") throw new Error("WebSocket is not available in this runtime.");
    connectionState = "connecting";
    ws = new WebSocket(config.websocketUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Home Assistant WebSocket authentication timed out.")), 12_000);
      if (!ws) {
        clearTimeout(timeout);
        reject(new Error("Home Assistant WebSocket was not created."));
        return;
      }

      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === "auth_required") {
          ws?.send(JSON.stringify({ type: "auth", access_token: config.token }));
          return;
        }
        if (message.type === "auth_ok") {
          clearTimeout(timeout);
          authenticated = true;
          connectionState = "connected";
          connectedAt = new Date().toISOString();
          reconnectAttempts = 0;
          resolve();
          return;
        }
        if (message.type === "auth_invalid") {
          clearTimeout(timeout);
          authenticated = false;
          connectionState = "error";
          reject(new Error("Home Assistant WebSocket authentication failed."));
          return;
        }
        if (message.type === "pong") {
          websocketLatencyMs = Date.now() - Number(message._sentAt || Date.now());
          return;
        }
        if (typeof message.id === "number" && pendingMessages.has(message.id)) {
          const handler = pendingMessages.get(message.id);
          pendingMessages.delete(message.id);
          handler?.(message);
          return;
        }
        if (message.type === "event" && message.event?.event_type === "state_changed") {
          const payload: HomeAssistantEventPayload = message.event;
          const newState = payload.data?.new_state;
          if (newState?.entity_id) {
            states.set(newState.entity_id, newState);
            queuePayload({ kind: "state_changed", event: payload });
            lastEventReceivedAt = new Date().toISOString();
            recordEventTime();
            notify(normalizeState(newState, payload.data?.old_state));
          }
        }
      };
      ws.onerror = () => {
        lastError = "Home Assistant WebSocket error.";
      };
      ws.onclose = () => {
        if (connectionState !== "disconnected") {
          connectionState = "disconnected";
          authenticated = false;
          reconnectCount += 1;
          scheduleReconnect();
        }
      };
    });

    await loadRegistries();
    await requestWs("subscribe_events", { event_type: "state_changed" });
    heartbeatTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const id = sendWs("ping");
      const sentAt = Date.now();
      pendingMessages.set(id, (message) => {
        if (message.type === "pong" || message.success !== false) websocketLatencyMs = Date.now() - sentAt;
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  async function initialize() {
    if (!resetConfig()) return;
    connectionState = "connecting";
    try {
      await bootstrapRest();
      connectionState = "initialized";
    } catch (error) {
      connectionState = "error";
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  async function connect() {
    if (!resetConfig()) return;
    cleanupSocket();
    try {
      if (states.size === 0) await bootstrapRest();
      await connectSocket();
      lastError = null;
    } catch (error) {
      connectionState = "error";
      authenticated = false;
      reconnectCount += 1;
      lastError = error instanceof Error ? error.message : String(error);
      scheduleReconnect();
    }
  }

  function disconnect() {
    cleanupSocket();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    connectionState = "disconnected";
  }

  function health(): AvaSensorHealth {
    const connectedForMs = connectedAt ? Date.now() - new Date(connectedAt).getTime() : 0;
    const status = connectionState === "connected" && authenticated ? "healthy"
      : connectionState === "connecting" ? "connecting"
        : connectionState === "disabled" ? "disabled"
          : connectionState === "error" ? "error"
            : "disconnected";

    return {
      status,
      message: lastError || `Home Assistant ${connectionState}.`,
      checkedAt: new Date().toISOString(),
      details: {
        connectionState,
        authenticated,
        entityCount: states.size,
        deviceCount: devices.size,
        areaCount: areas.size,
        websocketLatencyMs,
        reconnectCount,
        lastEventReceivedAt,
        lastSynchronizationAt,
        connectedAt,
        connectionDurationMs: connectedForMs,
        eventsPerMinute: recentEventTimes.length,
        connectionMode: config.connectionMode,
      },
    };
  }

  function capabilities(): AvaSensorCapability[] {
    return [
      { id: "rest-bootstrap", label: "REST Bootstrap", description: "Downloads Home Assistant config and states through the REST API." },
      { id: "registry-sync", label: "Registry Sync", description: "Downloads entity, device, and area registries over the authenticated WebSocket connection." },
      { id: "state-change-stream", label: "State Change Stream", description: "Subscribes to Home Assistant state_changed events and normalizes them into Ava observations." },
      { id: "read-only", label: "Read Only", description: "Does not call services, scripts, scenes, or control devices." },
    ];
  }

  function poll() {
    const payloads = [...queuedPayloads].reverse();
    queuedPayloads.length = 0;
    return payloads;
  }

  function subscribe(handler: AvaSensorSubscriptionHandler) {
    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }

  function normalize(payload: unknown) {
    const record = asRecord(payload);
    if (record.kind === "bootstrap") {
      return [normalizeState(record.state as HomeAssistantState)];
    }
    if (record.kind === "state_changed") {
      const event = record.event as HomeAssistantEventPayload;
      const newState = event.data?.new_state;
      if (!newState?.entity_id) return [];
      return [normalizeState(newState, event.data?.old_state)];
    }
    return [];
  }

  return {
    id: ADAPTER_ID,
    label: "Home Assistant",
    sourceType: SOURCE_TYPE,
    enabled: true,
    initialize,
    connect,
    disconnect,
    health,
    capabilities,
    poll,
    subscribe,
    normalize,
  };
}

export const HOME_ASSISTANT_ADAPTER_CONFIG = {
  id: ADAPTER_ID,
  label: "Home Assistant",
  sourceType: SOURCE_TYPE,
  supportedEntityTypes: ["sensor", "binary_sensor", "light", "switch", "climate", "camera", "person", "device_tracker", "automation"],
};
