import { NextResponse } from "next/server";
import { getAvaRuntime } from "@/lib/ava/runtime";

async function getStartedRuntime() {
  const runtime = getAvaRuntime();
  if (runtime.getStatus().lifecycleStage === "shutdown") {
    await runtime.start();
  }

  return runtime;
}

export async function GET() {
  const runtime = await getStartedRuntime();
  const diagnostics = runtime.perception.getDiagnostics();
  const stats = runtime.perception.getObservationStats();
  const lastObservation = runtime.perception.getLastObservation();

  return NextResponse.json({
    status: "ready",
    registeredAdapters: diagnostics.length,
    connectedAdapters: diagnostics.filter((adapter) => adapter.connected).length,
    disabledAdapters: diagnostics.filter((adapter) => !adapter.enabled || adapter.state === "disabled").length,
    adapters: diagnostics,
    adapterHealth: diagnostics.reduce<Record<string, unknown>>((health, adapter) => {
      health[adapter.id] = adapter.health;
      return health;
    }, {}),
    observationStatistics: stats,
    observationCounts: {
      total: stats.total,
      byAdapter: stats.byAdapter,
      byType: stats.byType,
    },
    lastObservation,
    runtimePerceptionStatus: {
      enabled: runtime.getStatus().config.featureFlags.perception,
      lastObservationAt: stats.lastObservationAt,
      eventThroughput: runtime.eventBus.getRecentEvents(100).filter((event) => event.type.startsWith("perception.")).length,
    },
  });
}
