import type {
  AvaObservation,
  AvaObservationStats,
} from "@/lib/ava/perception/observations";
import type { AvaSensorAdapter, AvaSensorAdapterDiagnostics } from "@/lib/ava/perception/sensor";
import type {
  AvaAttentionScore,
  AvaAwarenessSnapshot,
  AvaCoreJson,
  AvaCoreSnapshot,
  AvaChange,
  AvaEvent,
  AvaExecutiveContext,
  AvaFocusPlan,
  AvaRecommendation,
  AvaReasoningOutput,
  AvaSupabaseLike,
  AvaWorldModel,
} from "@/lib/ava/core/types";

export type AvaRuntimeLifecycleStage =
  | "startup"
  | "initializing"
  | "ready"
  | "idle"
  | "busy"
  | "recovering"
  | "shutdown";

export type AvaRuntimeEventPriority = "critical" | "high" | "normal" | "low";

export type AvaRuntimeEvent<TPayload extends AvaCoreJson = AvaCoreJson> = {
  id: string;
  type: string;
  priority: AvaRuntimeEventPriority;
  timestamp: string;
  source: string;
  origin: string;
  payload: TPayload;
};

export type AvaRuntimeEventInput<TPayload extends AvaCoreJson = AvaCoreJson> = {
  id?: string;
  type: string;
  priority?: AvaRuntimeEventPriority;
  timestamp?: string;
  source?: string;
  origin?: string;
  payload?: TPayload;
};

export type AvaRuntimeEventHandler<TPayload extends AvaCoreJson = AvaCoreJson> = (
  event: AvaRuntimeEvent<TPayload>,
) => void | Promise<void>;

export type AvaRuntimeEventMiddleware = (
  event: AvaRuntimeEvent,
  next: (event: AvaRuntimeEvent) => Promise<void>,
) => void | Promise<void>;

export type AvaRuntimeUnsubscribe = () => void;

export type AvaRuntimeSchedulerStatus = "stopped" | "running";

export type AvaRuntimeJobContext = {
  eventBus: {
    publish: <TPayload extends AvaCoreJson = AvaCoreJson>(
      event: AvaRuntimeEventInput<TPayload>,
    ) => Promise<AvaRuntimeEvent<TPayload>>;
  };
  store: {
    getState: () => AvaRuntimeState;
    setPartialState: (patch: Partial<AvaRuntimeState>) => AvaRuntimeState;
  };
  health: {
    reportModuleHealth: (moduleId: string, patch: Partial<AvaRuntimeModuleHealth>) => void;
    reportError: (moduleId: string, error: unknown) => void;
    reportWarning: (moduleId: string, warning: string) => void;
    recordSchedulerLatency: (latencyMs: number) => void;
  };
  config: AvaRuntimeConfig;
};

export type AvaRuntimeCognitionResult = {
  generatedAt: string;
  cognitiveState: {
    awareness: AvaAwarenessSnapshot;
    timeline: AvaEvent[];
    world: AvaWorldModel;
    reasoning: AvaReasoningOutput;
    attention: AvaAttentionScore[];
  };
  executiveContext: AvaExecutiveContext;
  currentSnapshot: AvaCoreSnapshot;
  previousSnapshot: AvaCoreSnapshot | null;
  detectedChanges: AvaChange[];
  visibleChanges: AvaChange[];
  changeEvents: AvaEvent[];
  recommendations: AvaRecommendation[];
  focusPlan: AvaFocusPlan;
  missionStatus: AvaExecutiveContext["missionStatus"];
};

export type AvaRuntimeSnapshotMetadata = {
  generatedAt: string;
  replacedAt: string;
  changeCount: number;
  source: string;
};

export type AvaRuntimeSnapshotState = {
  current: AvaCoreSnapshot | null;
  previous: AvaCoreSnapshot | null;
  metadata: AvaRuntimeSnapshotMetadata | null;
};

export type AvaRuntimeJob = {
  id: string;
  label: string;
  intervalMs: number;
  enabled: boolean;
  run: (context: AvaRuntimeJobContext) => Promise<void> | void;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
};

export type AvaRuntimeJobInput = Omit<AvaRuntimeJob, "lastRunAt" | "nextRunAt" | "lastDurationMs" | "lastError">;

export type AvaRuntimeSchedulerSnapshot = {
  status: AvaRuntimeSchedulerStatus;
  jobs: Array<Omit<AvaRuntimeJob, "run">>;
};

export type AvaRuntimeEntityType =
  | "person"
  | "room"
  | "device"
  | "vehicle"
  | "pet"
  | "project"
  | "automation"
  | "calendar";

export type AvaRuntimeEntity = {
  id: string;
  type: AvaRuntimeEntityType;
  name: string;
  aliases: string[];
  metadata: Record<string, AvaCoreJson>;
  createdAt: string;
  updatedAt: string;
};

export type AvaRuntimeContext = {
  currentMission: string | null;
  currentFocus: string | null;
  activeAlerts: AvaEvent[];
  currentConversation: string | null;
  activeUser: string | null;
  currentRoom: string | null;
  executiveContext: AvaExecutiveContext | null;
  currentGoals: string[];
  runtimeStatus: AvaRuntimeLifecycleStage;
  updatedAt: string;
};

export type AvaRuntimeState = {
  updatedAt: string | null;
  latestAwareness: AvaAwarenessSnapshot | null;
  latestTimeline: AvaEvent[];
  latestWorldModel: AvaWorldModel | null;
  latestReasoning: AvaReasoningOutput | null;
  latestAttention: AvaAttentionScore[];
  latestRecommendations: AvaRecommendation[];
  latestFocusPlan: AvaFocusPlan | null;
  latestExecutiveContext: AvaExecutiveContext | null;
  latestSnapshot: AvaCoreSnapshot | null;
  previousSnapshot: AvaCoreSnapshot | null;
  latestChanges: AvaChange[];
  latestVisibleChanges: AvaChange[];
  latestChangeEvents: AvaEvent[];
  latestRuntimeHealth: AvaRuntimeHealth | null;
  latestObservations: AvaObservation[];
  perceptionStats: AvaObservationStats;
  perceptionAdapters: AvaSensorAdapterDiagnostics[];
};

export type AvaRuntimeModuleHealth = {
  id: string;
  status: "healthy" | "warning" | "error" | "unknown";
  message: string | null;
  checkedAt: string;
};

export type AvaRuntimeHealth = {
  status: "healthy" | "warning" | "error" | "stopped";
  uptimeMs: number;
  startedAt: string | null;
  errors: string[];
  warnings: string[];
  modules: Record<string, AvaRuntimeModuleHealth>;
  integrations: Record<string, AvaRuntimeModuleHealth>;
  schedulerLatencyMs: number | null;
  heartbeatLatencyMs: number | null;
  memoryStatus: "configured" | "not_configured" | "unknown";
  runtimeStatus: AvaRuntimeLifecycleStage;
};

export type AvaRuntimeConfig = {
  heartbeatIntervalMs: number;
  schedulerIntervalMs: number;
  awarenessRefreshIntervalMs: number;
  executiveContextRefreshIntervalMs: number;
  snapshotIntervalMs: number;
  memoryPersistenceIntervalMs: number;
  cleanupIntervalMs: number;
  healthIntervalMs: number;
  perceptionIntervalMs: number;
  logging: boolean;
  debug: boolean;
  memoryPersistenceEnabled: boolean;
  featureFlags: {
    scheduler: boolean;
    memoryPersistence: boolean;
    runtimeStateReads: boolean;
    futureIntegrations: boolean;
    perception: boolean;
  };
};

export type AvaRuntimeDependencies = {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  cognitionPipeline?: AvaRuntimeCognitionPipeline;
  perceptionAdapters?: AvaSensorAdapter[];
};

export type AvaRuntimeStatus = {
  lifecycleStage: AvaRuntimeLifecycleStage;
  startedAt: string | null;
  stoppedAt: string | null;
  lastHeartbeatAt: string | null;
  heartbeatCount: number;
  scheduler: AvaRuntimeSchedulerSnapshot;
  health: AvaRuntimeHealth;
  config: AvaRuntimeConfig;
};

export type AvaRuntimeMemoryFlushResult = {
  enabled: boolean;
  attempted: boolean;
  persistedSnapshot: boolean;
  persistedChanges: number;
  persistedEvents: number;
  reason: string | null;
};

export type AvaRuntimeCognitionPipeline = (input: {
  previousSnapshot?: AvaCoreSnapshot | null;
}) => Promise<AvaRuntimeCognitionResult>;
