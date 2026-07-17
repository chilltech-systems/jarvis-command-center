const fs = require("fs");
const Module = require("module");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const name = line.slice(0, index);
    const value = line.slice(index + 1);
    if (!process.env[name]) process.env[name] = value;
  }
}

loadEnvLocal();

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      path.join(projectRoot, request.slice(2)),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
    fileName: filename,
  });

  module._compile(output.outputText, filename);
};

async function main() {
  const {
    createAvaRuntime,
    createAvaRuntimeEventBus,
    createAvaRuntimeStore,
    createAvaRuntimeContext,
    createAvaRuntimeEntityRegistry,
    persistAvaRuntimeMemory,
  } = require("../lib/ava/runtime");
  const {
    createAvaPerceptionManager,
    createDefaultPerceptionAdapters,
    createAvaObservation,
  } = require("../lib/ava/perception");

  const eventBus = createAvaRuntimeEventBus();
  let receivedEvent = null;
  const unsubscribe = eventBus.once("validation.event", (event) => {
    receivedEvent = event;
  });

  await eventBus.publish({
    type: "validation.event",
    priority: "high",
    source: "validation",
    origin: "script",
    payload: { ok: true },
  });
  unsubscribe();

  if (!receivedEvent || receivedEvent.payload.ok !== true) {
    throw new Error("Runtime event bus did not deliver a typed event.");
  }

  const store = createAvaRuntimeStore();
  store.setPartialState({ latestTimeline: [] });
  if (!store.getState().updatedAt) {
    throw new Error("Runtime state store did not update timestamp.");
  }

  const runtimeContext = createAvaRuntimeContext();
  runtimeContext.setContext({ currentMission: "Validate runtime foundation" });
  if (runtimeContext.getContext().currentMission !== "Validate runtime foundation") {
    throw new Error("Runtime context manager did not store current mission.");
  }

  const entities = createAvaRuntimeEntityRegistry();
  entities.registerEntity({ id: "project:ava-runtime", type: "project", name: "Ava Runtime" });
  if (!entities.getEntity("project:ava-runtime")) {
    throw new Error("Runtime entity registry did not store entity.");
  }

  const fakeSnapshot = (timestamp) => ({
    id: `validation-snapshot:${timestamp}`,
    timestamp,
    awareness: {
      generatedAt: timestamp,
      sources: {},
    },
    world: {
      generatedAt: timestamp,
      entities: [],
      entityIndex: {},
    },
    timelineSummary: {
      total: 0,
      byCategory: {},
      bySeverity: {},
      highestSeverity: "info",
      latestEventAt: null,
    },
    reasoningSummary: {
      topPriorityCount: 0,
      openRiskCount: 0,
      pendingApprovalCount: 0,
      suggestedFocus: "Validate runtime cognition",
    },
    attentionSummary: {
      critical: 0,
      high: 0,
      medium: 0,
      background: 0,
      ignore: 0,
    },
  });

  const fakeExecutiveContext = (timestamp, snapshot) => ({
    generatedAt: timestamp,
    missionStatus: "Calm",
    topPriorities: [],
    focusItems: {
      topPriorities: [],
      secondaryPriorities: [],
      backgroundItems: [],
      futureWork: [],
    },
    recentChanges: [],
    activeRisks: [],
    businessSummary: "Validation business summary",
    personalSummary: "Validation personal summary",
    automationSummary: "Validation automation summary",
    calendarSummary: "Validation calendar summary",
    weatherSummary: "Validation weather summary",
    pendingApprovals: [],
    recommendedActions: [],
    dailyBrief: {
      source: {},
      variant: "morning",
      summary: "Validation summary.",
      scheduleOverview: "Validation schedule.",
      taskPriorities: "Validation tasks.",
      weatherImpact: "Validation weather.",
      businessPulse: "Validation business.",
      automationIssues: "Validation automation.",
      suggestedFocus: "Validate runtime cognition",
      personalNotes: "Validation notes.",
    },
    intelligenceFeed: [],
    raw: {
      cognitiveState: {
        generatedAt: timestamp,
        awareness: snapshot.awareness,
        events: [],
        timeline: [],
        timelineSummary: snapshot.timelineSummary,
        world: snapshot.world,
        attention: [],
        reasoning: {
          generatedAt: timestamp,
          topPriorities: [],
          suggestedFocus: "Validate runtime cognition",
          openRisks: [],
          changesSinceLastSnapshot: [],
          pendingApprovals: [],
        },
      },
      currentSnapshot: snapshot,
      previousSnapshot: null,
      changeEvents: [],
    },
  });

  let pipelineRunCount = 0;
  const validationPipeline = async ({ previousSnapshot = null } = {}) => {
    pipelineRunCount += 1;
    const timestamp = new Date(Date.now() + pipelineRunCount).toISOString();
    const snapshot = fakeSnapshot(timestamp);
    const executiveContext = fakeExecutiveContext(timestamp, snapshot);

    return {
      generatedAt: timestamp,
      cognitiveState: {
        awareness: snapshot.awareness,
        timeline: [],
        world: snapshot.world,
        reasoning: executiveContext.raw.cognitiveState.reasoning,
        attention: [],
      },
      executiveContext,
      currentSnapshot: snapshot,
      previousSnapshot,
      detectedChanges: [],
      visibleChanges: [],
      changeEvents: [],
      recommendations: [],
      focusPlan: executiveContext.focusItems,
      missionStatus: executiveContext.missionStatus,
    };
  };

  const runtime = createAvaRuntime({
    config: {
      heartbeatIntervalMs: 100,
      awarenessRefreshIntervalMs: 1000,
      schedulerIntervalMs: 1000,
      featureFlags: {
        scheduler: true,
        memoryPersistence: false,
        runtimeStateReads: false,
        futureIntegrations: false,
      },
    },
    dependencies: {
      cognitionPipeline: validationPipeline,
    },
  });

  await runtime.start();
  const startedStatus = runtime.getStatus();

  if (startedStatus.lifecycleStage !== "idle") {
    throw new Error(`Runtime did not reach idle stage. Got ${startedStatus.lifecycleStage}.`);
  }

  if (startedStatus.heartbeatCount < 1) {
    throw new Error("Runtime heartbeat did not execute.");
  }

  await runtime.scheduler.runJob("cognition-refresh");

  if (pipelineRunCount < 2) {
    throw new Error("Runtime cognition pipeline did not run through scheduler.");
  }

  if (!runtime.store.getState().latestSnapshot) {
    throw new Error("Runtime store did not receive latest snapshot.");
  }

  if (!runtime.snapshots.getCurrent()) {
    throw new Error("Runtime snapshot manager did not store current snapshot.");
  }

  const runtimeEvents = runtime.eventBus.getRecentEvents(20).map((event) => event.type);
  for (const expectedEvent of [
    "runtime.cognition.completed",
    "runtime.snapshot.updated",
    "runtime.reasoning.updated",
    "runtime.executive-context.updated",
    "runtime.changes.detected",
  ]) {
    if (!runtimeEvents.includes(expectedEvent)) {
      throw new Error(`Runtime event bus did not receive ${expectedEvent}.`);
    }
  }

  const memoryResult = await persistAvaRuntimeMemory({
    result: runtime.store.getState().latestSnapshot ? {
      generatedAt: new Date().toISOString(),
      cognitiveState: {
        awareness: runtime.store.getState().latestAwareness,
        timeline: runtime.store.getState().latestTimeline,
        world: runtime.store.getState().latestWorldModel,
        reasoning: runtime.store.getState().latestReasoning,
        attention: runtime.store.getState().latestAttention,
      },
      executiveContext: runtime.store.getState().latestExecutiveContext,
      currentSnapshot: runtime.store.getState().latestSnapshot,
      previousSnapshot: runtime.store.getState().previousSnapshot,
      detectedChanges: runtime.store.getState().latestChanges,
      visibleChanges: runtime.store.getState().latestVisibleChanges,
      changeEvents: runtime.store.getState().latestChangeEvents,
      recommendations: runtime.store.getState().latestRecommendations,
      focusPlan: runtime.store.getState().latestFocusPlan,
      missionStatus: runtime.store.getState().latestExecutiveContext?.missionStatus || "Calm",
    } : null,
    config: {
      ...startedStatus.config,
      memoryPersistenceEnabled: true,
      featureFlags: {
        ...startedStatus.config.featureFlags,
        memoryPersistence: true,
      },
    },
  });

  if (memoryResult.reason !== "Supabase client or owner id was not provided.") {
    throw new Error("Runtime memory integration did not report missing persistence dependencies.");
  }

  const perceptionManager = createAvaPerceptionManager();
  const defaultAdapters = createDefaultPerceptionAdapters();
  defaultAdapters.forEach((adapter) => perceptionManager.registerAdapter(adapter));
  await perceptionManager.initializeAll();
  await perceptionManager.connectAll();
  const observations = await perceptionManager.collectObservations();
  const homeAssistantAdapter = perceptionManager.getDiagnostics().find((adapter) => adapter.id === "homeassistant");

  if (defaultAdapters.length < 8) {
    throw new Error("Default perception adapters were not registered.");
  }

  if (!observations.some((observation) => observation.sourceAdapter === "homeassistant")) {
    throw new Error(
      `Home Assistant live observations were not normalized. Diagnostics: ${JSON.stringify(homeAssistantAdapter || null)}`,
    );
  }

  for (const name of [
    "HOME_ASSISTANT_ENABLED",
    "HOME_ASSISTANT_LOCAL_URL",
    "HOME_ASSISTANT_WS_LOCAL",
    "HOME_ASSISTANT_CONNECTION_MODE",
    "HOME_ASSISTANT_TOKEN",
  ]) {
    if (!process.env[name]) throw new Error(`${name} was not loaded for Home Assistant validation.`);
  }

  if (!homeAssistantAdapter || homeAssistantAdapter.health.status !== "healthy") {
    throw new Error("Home Assistant adapter did not report healthy connection state.");
  }

  const haDetails = homeAssistantAdapter.health.details || {};
  if (haDetails.authenticated !== true) {
    throw new Error("Home Assistant WebSocket did not authenticate.");
  }
  if (Number(haDetails.entityCount || 0) <= 0) {
    throw new Error("Home Assistant entities did not download.");
  }
  if (typeof haDetails.deviceCount !== "number") {
    throw new Error("Home Assistant devices did not download.");
  }
  if (typeof haDetails.areaCount !== "number") {
    throw new Error("Home Assistant areas did not download.");
  }
  if (!haDetails.lastSynchronizationAt) {
    throw new Error("Home Assistant synchronization timestamp was not recorded.");
  }

  await runtime.scheduler.runJob("perception-refresh");

  const perceptionState = runtime.store.getState();
  if (!perceptionState.perceptionAdapters.length) {
    throw new Error("Runtime diagnostics did not receive perception adapters.");
  }

  if (perceptionState.perceptionStats.total < 1) {
    throw new Error("Runtime store did not receive perception observations.");
  }

  const perceptionEvents = runtime.eventBus.getRecentEvents(100).map((event) => event.type);
  if (!perceptionEvents.includes("perception.observation.received") || !perceptionEvents.includes("perception.refresh.completed")) {
    throw new Error("Runtime event bus did not receive perception events.");
  }

  const runtimeHomeAssistant = runtime.store.getState().perceptionAdapters.find((adapter) => adapter.id === "homeassistant");
  if (!runtimeHomeAssistant || runtimeHomeAssistant.health.status !== "healthy") {
    throw new Error("Runtime diagnostics did not receive healthy Home Assistant adapter state.");
  }

  const manualObservation = createAvaObservation({
    type: "sensor_reading",
    sourceAdapter: "validation",
    sourceType: "validation",
    entityId: "validation-sensor",
    entityType: "sensor",
    summary: "Validation sensor observation.",
    value: { ok: true },
  });

  if (manualObservation.sourceAdapter !== "validation" || manualObservation.type !== "sensor_reading") {
    throw new Error("Observation normalization model did not create a valid observation.");
  }

  const runtimeApiRoute = fs.readFileSync(path.join(projectRoot, "app/api/ava/runtime/route.ts"), "utf8");
  if (!runtimeApiRoute.includes("NextResponse.json") || !runtimeApiRoute.includes("currentSnapshotAgeMs")) {
    throw new Error("Runtime status API route is missing expected response fields.");
  }

  const perceptionApiRoute = fs.readFileSync(path.join(projectRoot, "app/api/ava/perception/route.ts"), "utf8");
  if (!perceptionApiRoute.includes("registeredAdapters") || !perceptionApiRoute.includes("observationStatistics")) {
    throw new Error("Perception API route is missing expected response fields.");
  }

  await perceptionManager.disconnectAll();
  await runtime.stop();
  const stoppedStatus = runtime.getStatus();

  if (stoppedStatus.lifecycleStage !== "shutdown") {
    throw new Error(`Runtime did not shut down. Got ${stoppedStatus.lifecycleStage}.`);
  }

  console.log("AVA_RUNTIME_FOUNDATION_OK");
  console.log("AVA_CONTINUOUS_COGNITION_OK");
  console.log("AVA_PERCEPTION_FRAMEWORK_OK");
  console.log("AVA_HOME_ASSISTANT_ADAPTER_OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
