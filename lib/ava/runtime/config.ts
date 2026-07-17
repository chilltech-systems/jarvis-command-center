import type { AvaRuntimeConfig } from "@/lib/ava/runtime/types";

export const DEFAULT_AVA_RUNTIME_CONFIG: AvaRuntimeConfig = {
  heartbeatIntervalMs: 30_000,
  schedulerIntervalMs: 10_000,
  awarenessRefreshIntervalMs: 5 * 60_000,
  executiveContextRefreshIntervalMs: 5 * 60_000,
  snapshotIntervalMs: 10 * 60_000,
  memoryPersistenceIntervalMs: 15 * 60_000,
  cleanupIntervalMs: 30 * 60_000,
  healthIntervalMs: 60_000,
  perceptionIntervalMs: 60_000,
  logging: false,
  debug: false,
  memoryPersistenceEnabled: false,
  featureFlags: {
    scheduler: true,
    memoryPersistence: false,
    runtimeStateReads: false,
    futureIntegrations: false,
    perception: true,
  },
};

export function createAvaRuntimeConfig(overrides: Partial<AvaRuntimeConfig> = {}): AvaRuntimeConfig {
  return {
    ...DEFAULT_AVA_RUNTIME_CONFIG,
    ...overrides,
    featureFlags: {
      ...DEFAULT_AVA_RUNTIME_CONFIG.featureFlags,
      ...overrides.featureFlags,
    },
  };
}
