const fs = require("fs");
const Module = require("module");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(projectRoot, request.slice(2)), parent, isMain, options);
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function awarenessFixtureDependencies(counters) {
  const counted = (name, value) => async () => {
    counters[name] = (counters[name] || 0) + 1;
    return value;
  };
  return {
    tasks: counted("tasks", {
      source: "live-todoist",
      error: null,
      tasks: [{ id: "task-1", title: "Validate Ava", status: "today", priority: 2 }],
      groups: { today: [], overdue: [], scheduled: [], unscheduled: [], upcoming: [] },
    }),
    completedTasks: counted("completedTasks", { source: "unavailable", error: "Not configured", completedToday: [] }),
    weather: counted("weather", { source: "mock", location: "Test", temperature: 70, condition: "Clear" }),
    projects: counted("projects", { source: "local-projects", projects: [{ name: "Ava", status: "Active" }], count: 1, active: 1 }),
    gmail: counted("gmail", { source: "unavailable", error: "Not configured", accounts: [] }),
    schedule: counted("schedule", { source: "live-todoist", todayItems: [], upcomingItems: [] }),
    connections: () => {
      counters.connections = (counters.connections || 0) + 1;
      return [];
    },
    automation: counted("automation", { source: "mock", failedWorkflows: 9, summary: "Synthetic failure" }),
  };
}

function createMemoryStore() {
  const rows = new Map();
  return {
    rows,
    client: {
      from() {
        const filters = {};
        const builder = {
          select() { return builder; },
          eq(column, value) { filters[column] = value; return builder; },
          order() { return builder; },
          limit(count) {
            const data = Array.from(rows.values())
              .filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value))
              .slice(0, count);
            return Promise.resolve({ data, error: null });
          },
          insert(values) { return Promise.resolve({ data: values, error: null }); },
          upsert(values) {
            const row = { ...values, updated_at: new Date().toISOString() };
            rows.set(`${row.owner_id}:${row.scope}:${row.memory_key}`, row);
            return Promise.resolve({ data: row, error: null });
          },
        };
        return builder;
      },
    },
  };
}

async function main() {
  const {
    buildAvaCognitiveState,
    buildAvaExecutiveContextFromState,
    buildAvaSnapshot,
    createSecondBrainMemory,
    evaluateLearningPromotion,
    promoteLearningMemory,
    writeSecondBrainMemory,
    querySecondBrainMemory,
    createOutcomeMemories,
    createCommitmentMemory,
    createCanonicalEntity,
    resolveCanonicalEntity,
    createCanonicalRelationship,
  } = require("../lib/ava/core");
  const {
    createAvaRuntime,
    createAvaRuntimeScheduler,
    runAvaRequestCognition,
    persistAvaRuntimeMemory,
    createAvaRuntimeConfig,
  } = require("../lib/ava/runtime");

  const awarenessCounters = {};
  const dependencies = awarenessFixtureDependencies(awarenessCounters);
  const state = await buildAvaCognitiveState([], { awarenessDependencies: dependencies });
  for (const name of ["tasks", "completedTasks", "weather", "projects", "gmail", "schedule", "connections", "automation"]) {
    assert(awarenessCounters[name] === 1, `Awareness source ${name} was not collected exactly once.`);
  }
  assert(state.events.some((event) => event.source === "todoist"), "Live Todoist data did not normalize.");
  assert(!state.events.some((event) => event.source === "weather"), "Mock weather leaked into cognition.");
  assert(!state.events.some((event) => event.source === "n8n"), "Mock automation data leaked into cognition.");

  const beforeContextCounts = JSON.stringify(awarenessCounters);
  const executiveContext = buildAvaExecutiveContextFromState({ cognitiveState: state, previousSnapshot: null });
  assert(JSON.stringify(awarenessCounters) === beforeContextCounts, "State-based Executive Context recollected awareness.");
  assert(executiveContext.raw.cognitiveState.awareness === state.awareness, "Executive Context did not retain the supplied cognitive state.");

  const strictMemory = createSecondBrainMemory({
    kind: "preference",
    summary: "Cody prefers compact operational briefings.",
    sourceReferences: [
      { source: "conversation", referenceId: "message-1" },
      { source: "feedback", referenceId: "correction-2" },
    ],
    confidence: 0.94,
    content: { preference: "compact operational briefings" },
  });
  assert(evaluateLearningPromotion(strictMemory).promotable, "Strict corroborated learning did not promote.");
  assert(promoteLearningMemory(strictMemory).status === "active", "Promoted memory did not become active.");
  const weakMemory = createSecondBrainMemory({
    kind: "preference",
    summary: "Possible preference.",
    sourceReferences: [{ source: "conversation", referenceId: "message-3" }],
    confidence: 0.99,
    content: { preference: "possible" },
  });
  assert(!evaluateLearningPromotion(weakMemory).promotable, "Single-source learning promoted unexpectedly.");
  const sensitiveMemory = { ...strictMemory, id: "sensitive", sensitive: true };
  assert(!evaluateLearningPromotion(sensitiveMemory).promotable, "Sensitive learning promoted automatically.");

  const memoryStore = createMemoryStore();
  await writeSecondBrainMemory({ supabase: memoryStore.client, ownerId: "owner-1", memory: promoteLearningMemory(strictMemory) });
  await writeSecondBrainMemory({ supabase: memoryStore.client, ownerId: "owner-1", memory: promoteLearningMemory(strictMemory) });
  assert(memoryStore.rows.size === 1, "Stable memory upsert created duplicate records.");
  const queried = await querySecondBrainMemory({ supabase: memoryStore.client, ownerId: "owner-1", kind: "preference" });
  assert(queried.length === 1 && queried[0].id === strictMemory.id, "Typed memory query did not return the stored preference.");
  const commitment = createCommitmentMemory({
    commitmentId: "commitment-1",
    summary: "Review the Ava core validation.",
    owner: "Cody",
    sourceReferences: [{ source: "conversation", referenceId: "message-4" }],
  });
  assert(commitment.kind === "commitment" && commitment.status === "active", "Commitment memory contract is invalid.");
  const outcomes = createOutcomeMemories({
    actionId: "action-1",
    action: "Run validation",
    outcome: "Validation failed.",
    status: "failed",
  });
  assert(outcomes.feedback.content.learningEligible === false, "A single failed action became learning-eligible.");

  const person = createCanonicalEntity({
    type: "Person",
    name: "Cody Hill",
    sourceReference: { source: "google", sourceId: "cody@example.com" },
    aliases: ["Cody"],
  });
  const exact = resolveCanonicalEntity({
    type: "Person",
    name: "Cody Hill",
    sourceReference: { source: "google", sourceId: "cody@example.com" },
    existing: [person],
  });
  assert(exact.resolution === "matched" && exact.entity.id === person.id, "Exact source identity did not resolve.");
  const alias = resolveCanonicalEntity({
    type: "Person",
    name: "Cody",
    sourceReference: { source: "slack", sourceId: "U123" },
    existing: [person],
  });
  assert(alias.resolution === "matched" && alias.entity.sourceReferences.length === 2, "Explicit alias did not resolve safely.");
  const duplicateAlias = createCanonicalEntity({
    type: "Person",
    name: "Cody Other",
    sourceReference: { source: "other", sourceId: "2" },
    aliases: ["Cody"],
  });
  const candidate = resolveCanonicalEntity({
    type: "Person",
    name: "Cody",
    sourceReference: { source: "calendar", sourceId: "3" },
    existing: [person, duplicateAlias],
  });
  assert(candidate.resolution === "candidate" && candidate.entity === null, "Ambiguous alias was merged automatically.");
  const relationship = createCanonicalRelationship({
    fromEntityId: person.id,
    toEntityId: "project:ava",
    relationship: "owns",
    sourceReferences: [{ source: "conversation", referenceId: "message-5" }],
  });
  assert(relationship.status === "active" && relationship.fromEntityId === person.id, "Canonical relationship contract is invalid.");

  const requestCounters = {};
  const requestRun = await runAvaRequestCognition({
    previousSnapshot: null,
    awarenessDependencies: awarenessFixtureDependencies(requestCounters),
    persist: false,
  });
  assert(requestRun.result.currentSnapshot, "Request cognition did not produce a snapshot.");
  assert(Object.values(requestCounters).every((count) => count === 1), "Request cognition collected an awareness source more than once.");

  const snapshot = buildAvaSnapshot(state);
  const runtimeResult = {
    generatedAt: new Date().toISOString(),
    cognitiveState: {
      awareness: state.awareness,
      timeline: state.timeline,
      world: state.world,
      reasoning: state.reasoning,
      attention: state.attention,
    },
    executiveContext,
    currentSnapshot: snapshot,
    previousSnapshot: snapshot,
    detectedChanges: [],
    visibleChanges: [],
    changeEvents: [],
    recommendations: executiveContext.recommendedActions,
    focusPlan: executiveContext.focusItems,
    missionStatus: executiveContext.missionStatus,
  };
  let pipelineRuns = 0;
  const requestRuntime = createAvaRuntime({
    config: { mode: "request", featureFlags: { scheduler: true, memoryPersistence: false, perception: true } },
    dependencies: {
      cognitionPipeline: async () => { pipelineRuns += 1; return runtimeResult; },
      perceptionAdapters: [],
    },
  });
  await requestRuntime.start();
  await requestRuntime.start();
  const requestStatus = requestRuntime.getStatus();
  assert(pipelineRuns === 2, "Request runtime did not run one fresh cycle per request.");
  assert(requestStatus.heartbeatCount === 0, "Request runtime created heartbeat activity.");
  assert(requestStatus.scheduler.status === "stopped", "Request runtime started scheduler timers.");
  assert(requestStatus.lastSuccessfulCognitionAt, "Request runtime did not expose cognition freshness.");
  await requestRuntime.stop();

  const failingRuntime = createAvaRuntime({
    config: { mode: "request" },
    dependencies: { cognitionPipeline: async () => { throw new Error("expected validation failure"); }, perceptionAdapters: [] },
  });
  try { await failingRuntime.start(); } catch {}
  assert(failingRuntime.getStatus().lifecycleStage === "idle", "Failed cognition stranded the runtime outside idle.");
  assert(failingRuntime.getStatus().lastFailedCognitionAt, "Failed cognition freshness was not recorded.");
  await failingRuntime.stop();

  let overlappingRuns = 0;
  let releaseJob;
  const jobGate = new Promise((resolve) => { releaseJob = resolve; });
  const scheduler = createAvaRuntimeScheduler({
    eventBus: { publish: async (event) => event },
    store: { getState: () => ({}), setPartialState: (patch) => patch },
    health: { reportModuleHealth() {}, reportError() {}, reportWarning() {}, recordSchedulerLatency() {} },
    config: createAvaRuntimeConfig({ mode: "continuous" }),
  });
  scheduler.addJob({ id: "overlap", label: "Overlap", intervalMs: 1000, enabled: true, run: async () => { overlappingRuns += 1; await jobGate; } });
  const firstJob = scheduler.runJob("overlap");
  const secondJob = scheduler.runJob("overlap");
  releaseJob();
  await Promise.all([firstJob, secondJob]);
  assert(overlappingRuns === 1, "Scheduler allowed overlapping execution of the same job.");

  const unchangedPersistence = await persistAvaRuntimeMemory({
    result: runtimeResult,
    config: createAvaRuntimeConfig({ mode: "request", memoryPersistenceEnabled: true, featureFlags: { scheduler: false, memoryPersistence: true, perception: false } }),
    supabase: memoryStore.client,
    ownerId: "owner-1",
  });
  assert(!unchangedPersistence.attempted && unchangedPersistence.reason === "No meaningful changes were detected.", "Unchanged cognition wrote memory churn.");
  const meaningfulChange = {
    id: "change-1",
    timestamp: new Date().toISOString(),
    type: "risk_introduced",
    category: "system",
    severity: "warning",
    classification: "Important",
    affectedEntity: { type: "System", id: "ava-core" },
    previousValue: null,
    currentValue: { status: "warning" },
    summary: "A meaningful validation risk appeared.",
    recommendedAction: "Review the validation risk.",
    confidence: 1,
    visibility: "user",
  };
  const meaningfulPersistence = await persistAvaRuntimeMemory({
    result: {
      ...runtimeResult,
      previousSnapshot: null,
      detectedChanges: [meaningfulChange],
      visibleChanges: [meaningfulChange],
      changeEvents: [{
        id: "change-event:change-1",
        timestamp: meaningfulChange.timestamp,
        source: "system",
        category: "change",
        severity: "warning",
        entityType: "Change",
        entityId: "change-1",
        summary: meaningfulChange.summary,
        payload: meaningfulChange,
        relatedEntities: [{ type: "System", id: "ava-core", relationship: "changed" }],
        visibility: "user",
      }],
    },
    config: createAvaRuntimeConfig({ mode: "request", memoryPersistenceEnabled: true, featureFlags: { scheduler: false, memoryPersistence: true, perception: false } }),
    supabase: memoryStore.client,
    ownerId: "owner-1",
  });
  assert(meaningfulPersistence.persistedMemories === 1, "Meaningful cognition did not create episodic second-brain memory.");
  assert(Array.from(memoryStore.rows.values()).some((row) => row.scope === "ava_episode"), "Meaningful episodic memory used the wrong scope.");

  console.log("AVA_SECOND_BRAIN_CORE_OK");
  console.log("AVA_REQUEST_SAFE_RUNTIME_OK");
  console.log("AVA_ADAPTIVE_MEMORY_OK");
  console.log("AVA_CANONICAL_ENTITIES_OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
