import type { AvaCoreJson } from "@/lib/ava/core/types";
import type { AvaObservation } from "@/lib/ava/perception/observations";

export type AvaSensorHealthStatus = "healthy" | "warning" | "error" | "disabled" | "disconnected" | "connecting";

export type AvaSensorHealth = {
  status: AvaSensorHealthStatus;
  message: string | null;
  checkedAt: string;
  details?: Record<string, AvaCoreJson>;
};

export type AvaSensorCapability = {
  id: string;
  label: string;
  description: string;
};

export type AvaSensorAdapterState = "registered" | "initialized" | "connected" | "disabled" | "disconnected";

export type AvaSensorSubscriptionHandler = (observation: AvaObservation) => void | Promise<void>;

export type AvaSensorAdapter = {
  id: string;
  label: string;
  sourceType: string;
  enabled: boolean;
  initialize: () => Promise<void> | void;
  connect: () => Promise<void> | void;
  disconnect: () => Promise<void> | void;
  health: () => Promise<AvaSensorHealth> | AvaSensorHealth;
  capabilities: () => AvaSensorCapability[];
  poll: () => Promise<unknown[]> | unknown[];
  subscribe: (handler: AvaSensorSubscriptionHandler) => (() => void) | void;
  normalize: (payload: unknown) => Promise<AvaObservation[]> | AvaObservation[];
};

export type AvaSensorAdapterDiagnostics = {
  id: string;
  label: string;
  sourceType: string;
  enabled: boolean;
  state: AvaSensorAdapterState;
  health: AvaSensorHealth;
  capabilityCount: number;
  observationCount: number;
  lastObservationAt: string | null;
  connected: boolean;
};

export type AvaPlaceholderAdapterOptions = {
  id: string;
  label: string;
  sourceType: string;
  capabilities: AvaSensorCapability[];
  supportedEntityTypes?: string[];
  placeholderObservation?: {
    type: AvaObservation["type"];
    entityType?: string;
    entityId?: string;
    summary: string;
    value?: AvaCoreJson;
    metadata?: Record<string, AvaCoreJson>;
  };
};
