import type {
  AvaRuntimeHealth,
  AvaRuntimeLifecycleStage,
  AvaRuntimeModuleHealth,
} from "@/lib/ava/runtime/types";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function nowModuleHealth(
  id: string,
  patch: Partial<AvaRuntimeModuleHealth>,
): AvaRuntimeModuleHealth {
  return {
    id,
    status: patch.status || "unknown",
    message: patch.message ?? null,
    checkedAt: patch.checkedAt || new Date().toISOString(),
  };
}

export function createAvaRuntimeHealthManager({
  memoryConfigured = false,
}: {
  memoryConfigured?: boolean;
} = {}) {
  let startedAt: string | null = null;
  let schedulerLatencyMs: number | null = null;
  let heartbeatLatencyMs: number | null = null;
  const errors: string[] = [];
  const warnings: string[] = [];
  const modules: Record<string, AvaRuntimeModuleHealth> = {};
  const integrations: Record<string, AvaRuntimeModuleHealth> = {};

  function start() {
    startedAt = new Date().toISOString();
  }

  function stop() {
    startedAt = null;
  }

  function reportModuleHealth(moduleId: string, patch: Partial<AvaRuntimeModuleHealth>) {
    modules[moduleId] = nowModuleHealth(moduleId, patch);
  }

  function reportIntegrationHealth(integrationId: string, patch: Partial<AvaRuntimeModuleHealth>) {
    integrations[integrationId] = nowModuleHealth(integrationId, patch);
  }

  function reportError(moduleId: string, error: unknown) {
    const message = `${moduleId}: ${errorMessage(error)}`;
    errors.unshift(message);
    reportModuleHealth(moduleId, { status: "error", message });
  }

  function reportWarning(moduleId: string, warning: string) {
    const message = `${moduleId}: ${warning}`;
    warnings.unshift(message);
    reportModuleHealth(moduleId, { status: "warning", message });
  }

  function recordSchedulerLatency(latencyMs: number) {
    schedulerLatencyMs = latencyMs;
  }

  function recordHeartbeatLatency(latencyMs: number) {
    heartbeatLatencyMs = latencyMs;
  }

  function getHealth(runtimeStatus: AvaRuntimeLifecycleStage): AvaRuntimeHealth {
    const moduleStates = [...Object.values(modules), ...Object.values(integrations)];
    const hasErrors = moduleStates.some((moduleHealth) => moduleHealth.status === "error");
    const hasWarnings = moduleStates.some((moduleHealth) => moduleHealth.status === "warning");
    const uptimeMs = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;

    return {
      status: runtimeStatus === "shutdown" ? "stopped" : hasErrors ? "error" : hasWarnings ? "warning" : "healthy",
      uptimeMs,
      startedAt,
      errors: errors.slice(0, 25),
      warnings: warnings.slice(0, 25),
      modules: { ...modules },
      integrations: { ...integrations },
      schedulerLatencyMs,
      heartbeatLatencyMs,
      memoryStatus: memoryConfigured ? "configured" : "not_configured",
      runtimeStatus,
    };
  }

  return {
    start,
    stop,
    reportModuleHealth,
    reportIntegrationHealth,
    reportError,
    reportWarning,
    recordSchedulerLatency,
    recordHeartbeatLatency,
    getHealth,
  };
}
