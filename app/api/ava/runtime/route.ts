import { NextResponse } from "next/server";
import { getAvaRuntime } from "@/lib/ava/runtime";

async function getStartedRuntime() {
  const runtime = getAvaRuntime();
  const status = runtime.getStatus();

  if (status.lifecycleStage === "shutdown") {
    await runtime.start();
  }

  return runtime;
}

export async function GET() {
  const runtime = await getStartedRuntime();
  const status = runtime.getStatus();
  const state = runtime.store.getState();
  const runtimeContext = runtime.context.getContext();
  const snapshotAgeMs = runtime.snapshots.getSnapshotAgeMs();
  const health = status.health;

  return NextResponse.json({
    runtimeStatus: status.lifecycleStage,
    uptimeMs: health.uptimeMs,
    heartbeat: {
      lastHeartbeatAt: status.lastHeartbeatAt,
      heartbeatCount: status.heartbeatCount,
      latencyMs: health.heartbeatLatencyMs,
    },
    schedulerStatus: status.scheduler.status,
    schedulerJobs: status.scheduler.jobs,
    currentSnapshotAgeMs: snapshotAgeMs,
    currentMissionStatus: state.latestExecutiveContext?.missionStatus || null,
    currentFocus: runtimeContext.currentFocus,
    healthSummary: {
      status: health.status,
      errors: health.errors.length,
      warnings: health.warnings.length,
      schedulerLatencyMs: health.schedulerLatencyMs,
      memoryStatus: health.memoryStatus,
    },
    currentState: {
      awarenessUpdatedAt: state.latestAwareness?.generatedAt || null,
      timelineCount: state.latestTimeline.length,
      changeCount: state.latestChanges.length,
      visibleChangeCount: state.latestVisibleChanges.length,
      recommendationCount: state.latestRecommendations.length,
      hasExecutiveContext: Boolean(state.latestExecutiveContext),
      hasSnapshot: Boolean(state.latestSnapshot),
    },
    diagnostics: {
      lifecycleStage: status.lifecycleStage,
      eventBusSubscriptions: runtime.eventBus.getSubscriptionCount(),
      recentEvents: runtime.eventBus.getRecentEvents(12),
      entityCounts: runtime.entities.listEntities().reduce<Record<string, number>>((counts, entity) => {
        counts[entity.type] = (counts[entity.type] || 0) + 1;
        return counts;
      }, {}),
      perception: {
        adapters: runtime.perception.getDiagnostics(),
        observationStats: runtime.perception.getObservationStats(),
        lastObservation: runtime.perception.getLastObservation(),
      },
      snapshotMetadata: runtime.snapshots.getState().metadata,
    },
  });
}
