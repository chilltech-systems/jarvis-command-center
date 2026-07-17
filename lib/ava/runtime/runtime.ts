import { createAvaRuntimeConfig } from "@/lib/ava/runtime/config";
import { createAvaRuntimeContext } from "@/lib/ava/runtime/context";
import { runAvaRuntimeCognition } from "@/lib/ava/runtime/cognition";
import { createAvaPerceptionManager, createDefaultPerceptionAdapters } from "@/lib/ava/perception";
import { createAvaRuntimeEntityRegistry } from "@/lib/ava/runtime/entities";
import { createAvaRuntimeEventBus } from "@/lib/ava/runtime/event-bus";
import { createAvaRuntimeHealthManager } from "@/lib/ava/runtime/health";
import { createAvaRuntimeLifecycle } from "@/lib/ava/runtime/lifecycle";
import { persistAvaRuntimeMemory } from "@/lib/ava/runtime/memory";
import { createAvaRuntimeScheduler } from "@/lib/ava/runtime/scheduler";
import { createAvaRuntimeSnapshotManager } from "@/lib/ava/runtime/snapshots";
import { createAvaRuntimeStore } from "@/lib/ava/runtime/store";
import type {
  AvaRuntimeConfig,
  AvaRuntimeCognitionResult,
  AvaRuntimeDependencies,
  AvaRuntimeJobContext,
  AvaRuntimeStatus,
} from "@/lib/ava/runtime/types";

function createHeartbeatTimer(intervalMs: number, heartbeat: () => Promise<void>) {
  return setInterval(() => {
    void heartbeat();
  }, intervalMs);
}

export function createAvaRuntime({
  config: configOverrides = {},
  dependencies = {},
}: {
  config?: Partial<AvaRuntimeConfig>;
  dependencies?: AvaRuntimeDependencies;
} = {}) {
  const config = createAvaRuntimeConfig(configOverrides);
  const eventBus = createAvaRuntimeEventBus();
  const store = createAvaRuntimeStore();
  const context = createAvaRuntimeContext();
  const entities = createAvaRuntimeEntityRegistry();
  const lifecycle = createAvaRuntimeLifecycle();
  const snapshots = createAvaRuntimeSnapshotManager();
  const perception = createAvaPerceptionManager();
  const health = createAvaRuntimeHealthManager({
    memoryConfigured: Boolean(dependencies.supabase && dependencies.ownerId),
  });
  const cognitionPipeline = dependencies.cognitionPipeline || runAvaRuntimeCognition;
  const perceptionAdapters = dependencies.perceptionAdapters || createDefaultPerceptionAdapters();
  let startedAt: string | null = null;
  let stoppedAt: string | null = null;
  let lastHeartbeatAt: string | null = null;
  let heartbeatCount = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let latestCognitionResult: AvaRuntimeCognitionResult | null = null;

  const schedulerContext: AvaRuntimeJobContext = {
    eventBus,
    store,
    health,
    config,
  };
  const scheduler = createAvaRuntimeScheduler(schedulerContext);

  lifecycle.onChange((stage) => {
    context.setContext({ runtimeStatus: stage });
  });

  for (const adapter of perceptionAdapters) {
    perception.registerAdapter(adapter);
  }

  async function runCognitionCycle(origin = "scheduler") {
    await lifecycle.transition("busy");
    await eventBus.publish({
      type: "runtime.scheduler.tick",
      source: "ava-runtime",
      origin,
      payload: {
        timestamp: new Date().toISOString(),
      },
    });

    const result = await cognitionPipeline({
      previousSnapshot: snapshots.getCurrent(),
    });
    latestCognitionResult = result;
    const snapshotState = snapshots.replace(result.currentSnapshot, {
      changeCount: result.detectedChanges.length,
      source: origin,
    });

    store.setPartialState({
      latestAwareness: result.cognitiveState.awareness,
      latestTimeline: result.cognitiveState.timeline,
      latestWorldModel: result.cognitiveState.world,
      latestReasoning: result.cognitiveState.reasoning,
      latestAttention: result.cognitiveState.attention,
      latestRecommendations: result.recommendations,
      latestFocusPlan: result.focusPlan,
      latestExecutiveContext: result.executiveContext,
      latestSnapshot: snapshotState.current,
      previousSnapshot: snapshotState.previous,
      latestChanges: result.detectedChanges,
      latestVisibleChanges: result.visibleChanges,
      latestChangeEvents: result.changeEvents,
      latestRuntimeHealth: health.getHealth(lifecycle.getStage()),
      perceptionAdapters: perception.getDiagnostics(),
      perceptionStats: perception.getObservationStats(),
    });
    context.setContext({
      executiveContext: result.executiveContext,
      currentFocus: result.focusPlan.topPriorities[0]?.title || result.cognitiveState.reasoning.suggestedFocus,
      activeAlerts: result.changeEvents,
      runtimeStatus: lifecycle.getStage(),
    });

    await eventBus.publish({
      type: "runtime.cognition.completed",
      source: "ava-runtime",
      origin,
      payload: {
        generatedAt: result.generatedAt,
        eventCount: result.cognitiveState.timeline.length,
        changeCount: result.detectedChanges.length,
      },
    });
    await eventBus.publish({
      type: "runtime.snapshot.updated",
      source: "ava-runtime",
      origin,
      payload: {
        snapshotId: result.currentSnapshot.id,
        previousSnapshotId: result.previousSnapshot?.id || null,
        snapshotAgeMs: snapshots.getSnapshotAgeMs(),
      },
    });
    await eventBus.publish({
      type: "runtime.reasoning.updated",
      source: "ava-runtime",
      origin,
      payload: {
        priorityCount: result.cognitiveState.reasoning.topPriorities.length,
        riskCount: result.cognitiveState.reasoning.openRisks.length,
        suggestedFocus: result.cognitiveState.reasoning.suggestedFocus,
      },
    });
    await eventBus.publish({
      type: "runtime.executive-context.updated",
      source: "ava-runtime",
      origin,
      payload: {
        generatedAt: result.executiveContext.generatedAt,
        missionStatus: result.missionStatus,
        recommendedActionCount: result.recommendations.length,
      },
    });
    await eventBus.publish({
      type: "runtime.changes.detected",
      source: "ava-runtime",
      origin,
      payload: {
        detectedCount: result.detectedChanges.length,
        visibleCount: result.visibleChanges.length,
      },
    });
    await lifecycle.transition("idle");

    return result;
  }

  async function runPerceptionCycle(origin = "scheduler", triggerCognition = true) {
    const observations = await perception.collectObservations();
    await perception.publishObservations({
      eventBus,
      entities,
      context,
      store,
    }, observations);
    store.setPartialState({
      perceptionAdapters: perception.getDiagnostics(),
      perceptionStats: perception.getObservationStats(),
    });

    await eventBus.publish({
      type: "perception.refresh.completed",
      source: "ava-perception",
      origin,
      payload: {
        observationCount: observations.length,
        adapterCount: perception.listAdapters().length,
        lastObservationAt: perception.getLastObservation()?.timestamp || null,
      },
    });

    if (triggerCognition && observations.length > 0) {
      await runCognitionCycle("perception:observation");
    }

    return observations;
  }

  scheduler.addJob({
    id: "cognition-refresh",
    label: "Cognition refresh",
    intervalMs: config.awarenessRefreshIntervalMs,
    enabled: config.featureFlags.scheduler,
    run: async () => {
      await runCognitionCycle("scheduler:cognition-refresh");
    },
  });

  scheduler.addJob({
    id: "memory-persistence",
    label: "Memory persistence",
    intervalMs: config.memoryPersistenceIntervalMs,
    enabled: config.memoryPersistenceEnabled && config.featureFlags.memoryPersistence,
    run: async () => {
      const memoryResult = await persistAvaRuntimeMemory({
        result: latestCognitionResult,
        config,
        supabase: dependencies.supabase,
        ownerId: dependencies.ownerId,
      });

      await eventBus.publish({
        type: "runtime.memory.persisted",
        source: "ava-runtime",
        origin: "scheduler",
        payload: {
          enabled: memoryResult.enabled,
          attempted: memoryResult.attempted,
          persistedSnapshot: memoryResult.persistedSnapshot,
          persistedChanges: memoryResult.persistedChanges,
          persistedEvents: memoryResult.persistedEvents,
        },
      });
    },
  });

  scheduler.addJob({
    id: "perception-refresh",
    label: "Perception refresh",
    intervalMs: config.perceptionIntervalMs,
    enabled: config.featureFlags.scheduler && config.featureFlags.perception,
    run: async () => {
      await runPerceptionCycle("scheduler:perception-refresh");
    },
  });

  scheduler.addJob({
    id: "diagnostics",
    label: "Diagnostics",
    intervalMs: config.schedulerIntervalMs,
    enabled: config.featureFlags.scheduler,
    run: async () => {
      store.setPartialState({
        latestRuntimeHealth: health.getHealth(lifecycle.getStage()),
      });
      await eventBus.publish({
        type: "runtime.diagnostics.updated",
        source: "ava-runtime",
        origin: "scheduler",
        payload: {
          eventBusSubscriptionCount: eventBus.getSubscriptionCount(),
          entityCount: entities.listEntities().length,
          snapshotAgeMs: snapshots.getSnapshotAgeMs(),
          adapterCount: perception.listAdapters().length,
          observationCount: perception.getObservationStats().total,
        },
      });
    },
  });

  scheduler.addJob({
    id: "runtime-cleanup",
    label: "Runtime cleanup",
    intervalMs: config.cleanupIntervalMs,
    enabled: config.featureFlags.scheduler,
    run: async () => {
      health.reportModuleHealth("runtime-cleanup", {
        status: "healthy",
        message: "Runtime cleanup completed.",
      });
      await eventBus.publish({
        type: "runtime.cleanup.completed",
        source: "ava-runtime",
        origin: "scheduler",
        payload: {},
      });
    },
  });

  scheduler.addJob({
    id: "health-monitor",
    label: "Health monitor",
    intervalMs: config.healthIntervalMs,
    enabled: config.featureFlags.scheduler,
    run: async () => {
      health.reportModuleHealth("runtime", {
        status: "healthy",
        message: `Runtime is ${lifecycle.getStage()}.`,
      });
      store.setPartialState({
        latestRuntimeHealth: health.getHealth(lifecycle.getStage()),
      });
      await eventBus.publish({
        type: "runtime.health.changed",
        source: "ava-runtime",
        origin: "scheduler",
        payload: {
          status: health.getHealth(lifecycle.getStage()).status,
        },
      });
    },
  });

  async function heartbeat() {
    const started = Date.now();
    heartbeatCount += 1;
    lastHeartbeatAt = new Date().toISOString();
    health.recordHeartbeatLatency(Date.now() - started);
    health.reportModuleHealth("heartbeat", {
      status: "healthy",
      message: `Heartbeat ${heartbeatCount} recorded.`,
    });

    await eventBus.publish({
      type: "runtime.heartbeat",
      source: "ava-runtime",
      origin: "runtime",
      payload: {
        heartbeatCount,
        timestamp: lastHeartbeatAt,
      },
    });
  }

  async function start() {
    if (lifecycle.getStage() !== "shutdown") return getStatus();

    startedAt = new Date().toISOString();
    stoppedAt = null;
    health.start();
    await lifecycle.transition("startup");
    await lifecycle.transition("initializing");
    await eventBus.publish({
      type: "runtime.starting",
      source: "ava-runtime",
      origin: "runtime",
      payload: { startedAt },
    });

    if (config.featureFlags.perception) {
      await perception.initializeAll();
      await perception.connectAll();
      store.setPartialState({
        perceptionAdapters: perception.getDiagnostics(),
        perceptionStats: perception.getObservationStats(),
      });
      await runPerceptionCycle("runtime:start", false);
      await eventBus.publish({
        type: "perception.manager.initialized",
        source: "ava-perception",
        origin: "runtime",
        payload: {
          adapterCount: perception.listAdapters().length,
          enabledAdapterCount: perception.listAdapters().filter((adapter) => adapter.enabled).length,
        },
      });
    }

    if (config.featureFlags.scheduler) scheduler.start();
    heartbeatTimer = createHeartbeatTimer(config.heartbeatIntervalMs, heartbeat);
    await heartbeat();
    await runCognitionCycle("runtime:start");
    await lifecycle.transition("ready");
    await lifecycle.transition("idle");
    await eventBus.publish({
      type: "runtime.started",
      source: "ava-runtime",
      origin: "runtime",
      payload: { startedAt },
    });

    return getStatus();
  }

  async function stop() {
    if (lifecycle.getStage() === "shutdown") return getStatus();

    await lifecycle.transition("shutdown");
    scheduler.stop();
    await perception.disconnectAll();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    stoppedAt = new Date().toISOString();
    health.stop();
    await eventBus.publish({
      type: "runtime.stopped",
      source: "ava-runtime",
      origin: "runtime",
      payload: { stoppedAt },
    });

    return getStatus();
  }

  async function restart() {
    await stop();
    return start();
  }

  function getStatus(): AvaRuntimeStatus {
    const lifecycleStage = lifecycle.getStage();

    return {
      lifecycleStage,
      startedAt,
      stoppedAt,
      lastHeartbeatAt,
      heartbeatCount,
      scheduler: scheduler.getSnapshot(),
      health: health.getHealth(lifecycleStage),
      config,
    };
  }

  return {
    start,
    stop,
    restart,
    heartbeat,
    getStatus,
    eventBus,
    scheduler,
    store,
    context,
    entities,
    lifecycle,
    health,
    snapshots,
    perception,
    runCognitionCycle,
    runPerceptionCycle,
  };
}

let runtimeSingleton: ReturnType<typeof createAvaRuntime> | null = null;

export function getAvaRuntime() {
  if (!runtimeSingleton) runtimeSingleton = createAvaRuntime();

  return runtimeSingleton;
}
