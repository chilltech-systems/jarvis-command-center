export type AvaCoreJson =
  | string
  | number
  | boolean
  | null
  | AvaCoreJson[]
  | { [key: string]: AvaCoreJson };

export type AvaEventSource =
  | "todoist"
  | "gmail"
  | "weather"
  | "calendar"
  | "n8n"
  | "project"
  | "connection"
  | "approval"
  | "conversation"
  | "codex"
  | "slack"
  | "health"
  | "home"
  | "vehicle"
  | "garden"
  | "business"
  | "system"
  | "unknown";

export type AvaEventCategory =
  | "task"
  | "email"
  | "weather"
  | "calendar"
  | "automation"
  | "project"
  | "business"
  | "codex"
  | "approval"
  | "conversation"
  | "slack"
  | "health"
  | "home"
  | "vehicle"
  | "garden"
  | "connection"
  | "change"
  | "system";

export type AvaSeverity = "critical" | "urgent" | "warning" | "normal" | "info";
export type AvaVisibility = "internal" | "user";

export type AvaEntityType =
  | "Person"
  | "Project"
  | "Store"
  | "Automation"
  | "Task"
  | "Weather"
  | "CalendarEvent"
  | "Device"
  | "Business"
  | "Pet"
  | "Home"
  | "Vehicle"
  | "Garden"
  | "Connection"
  | "Approval"
  | "Conversation"
  | "CodexRun"
  | "Change"
  | "System";

export type AvaRelatedEntity = {
  type: AvaEntityType;
  id: string;
  relationship: string;
};

export type AvaEvent<TPayload extends AvaCoreJson = AvaCoreJson> = {
  id: string;
  timestamp: string;
  source: AvaEventSource;
  category: AvaEventCategory;
  severity: AvaSeverity;
  entityType: AvaEntityType;
  entityId: string;
  summary: string;
  payload: TPayload;
  relatedEntities: AvaRelatedEntity[];
  visibility: AvaVisibility;
};

export type AvaChangeType =
  | "task_added"
  | "task_completed"
  | "task_removed"
  | "project_status_changed"
  | "weather_changed"
  | "temperature_changed"
  | "automation_failed"
  | "automation_recovered"
  | "calendar_added"
  | "calendar_removed"
  | "business_metric_increased"
  | "business_metric_decreased"
  | "attention_priority_increased"
  | "risk_cleared"
  | "risk_introduced"
  | "entity_added"
  | "entity_removed"
  | "entity_changed";

export type AvaChangeClassification = "Informational" | "Minor" | "Important" | "Critical" | "Hidden";

export type AvaChange<TPrevious extends AvaCoreJson = AvaCoreJson, TCurrent extends AvaCoreJson = AvaCoreJson> = {
  id: string;
  timestamp: string;
  type: AvaChangeType;
  category: AvaEventCategory;
  severity: AvaSeverity;
  classification: AvaChangeClassification;
  affectedEntity: {
    type: AvaEntityType;
    id: string;
  };
  previousValue: TPrevious;
  currentValue: TCurrent;
  summary: string;
  recommendedAction: string;
  confidence: number;
  visibility: AvaVisibility;
};

export type AvaSourceState = {
  source: string;
  status: "live" | "fallback" | "unavailable" | "unknown";
  freshness: "fresh" | "stale" | "unknown";
  error?: string | null;
  updatedAt: string;
};

export type AvaAwarenessSnapshot = {
  generatedAt: string;
  tasks?: unknown;
  completedTasks?: unknown;
  weather?: unknown;
  projects?: unknown;
  gmail?: unknown;
  connections?: unknown;
  automation?: unknown;
  calendar?: unknown;
  dashboardContext?: unknown;
  sources: Record<string, AvaSourceState>;
};

export type AvaTimelineFilter = {
  sources?: AvaEventSource[];
  categories?: AvaEventCategory[];
  severities?: AvaSeverity[];
  entityTypes?: AvaEntityType[];
  visibility?: AvaVisibility;
  since?: string;
  until?: string;
};

export type AvaTimelineGroup = {
  key: string;
  events: AvaEvent[];
  count: number;
  highestSeverity: AvaSeverity;
};

export type AvaTimelineSummary = {
  total: number;
  byCategory: Partial<Record<AvaEventCategory, number>>;
  bySeverity: Partial<Record<AvaSeverity, number>>;
  highestSeverity: AvaSeverity;
  latestEventAt: string | null;
};

export type AvaSnapshotSummary = {
  timeline: AvaTimelineSummary;
  reasoning: {
    topPriorityCount: number;
    openRiskCount: number;
    pendingApprovalCount: number;
    suggestedFocus: string;
  };
  attention: {
    critical: number;
    high: number;
    medium: number;
    background: number;
    ignore: number;
  };
};

export type AvaEntityHealth = "healthy" | "watch" | "at_risk" | "critical" | "unknown";

export type AvaWorldEntity = {
  id: string;
  canonicalId?: string;
  type: AvaEntityType;
  name: string;
  currentState: string;
  health: AvaEntityHealth;
  priority: number;
  relationships: AvaRelatedEntity[];
  lastUpdated: string;
  activeAlerts: AvaEvent[];
  payload?: AvaCoreJson;
};

export type AvaWorldModel = {
  generatedAt: string;
  entities: AvaWorldEntity[];
  entityIndex: Record<string, AvaWorldEntity>;
};

export type AvaAttentionBand = "Critical" | "High" | "Medium" | "Background" | "Ignore";

export type AvaAttentionScore = {
  eventId: string;
  score: number;
  band: AvaAttentionBand;
  reasons: string[];
};

export type AvaPriority = {
  id: string;
  title: string;
  summary: string;
  severity: AvaSeverity;
  entityType: AvaEntityType;
  entityId: string;
  score: number;
};

export type AvaReasoningOutput = {
  generatedAt: string;
  topPriorities: AvaPriority[];
  suggestedFocus: string;
  openRisks: AvaPriority[];
  changesSinceLastSnapshot: string[];
  pendingApprovals: AvaPriority[];
};

export type AvaCoreSnapshot = {
  id: string;
  timestamp: string;
  awareness: AvaAwarenessSnapshot;
  world: AvaWorldModel;
  timelineSummary: AvaTimelineSummary;
  reasoningSummary: AvaSnapshotSummary["reasoning"];
  attentionSummary: AvaSnapshotSummary["attention"];
};

export type AvaChangeSummary = {
  total: number;
  visible: number;
  byClassification: Partial<Record<AvaChangeClassification, number>>;
  byCategory: Partial<Record<AvaEventCategory, number>>;
  sentences: string[];
  headline: string;
};

export type AvaMemoryRecord<TContent extends AvaCoreJson = AvaCoreJson> = {
  scope:
    | "ava_core_event"
    | "ava_core_snapshot"
    | "ava_core_daily_snapshot"
    | "ava_core_change"
    | "ava_core_notable_change"
    | "dashboard_daily_snapshot"
    | AvaSecondBrainMemoryScope;
  memoryKey: string;
  source: string;
  confidence: number;
  active: boolean;
  content: TContent;
};

export type AvaSecondBrainMemoryScope =
  | "ava_working_memory"
  | "ava_episode"
  | "ava_fact"
  | "ava_procedure"
  | "ava_commitment"
  | "ava_preference"
  | "ava_feedback"
  | "ava_entity"
  | "ava_entity_relationship"
  | "ava_identity_candidate";

export type AvaSecondBrainMemoryKind =
  | "working"
  | "episode"
  | "fact"
  | "procedure"
  | "commitment"
  | "preference"
  | "feedback"
  | "entity"
  | "relationship"
  | "identity_candidate";

export type AvaMemoryStatus = "active" | "review" | "superseded" | "resolved";

export type AvaMemorySourceReference = {
  source: string;
  referenceId?: string | null;
  observedAt?: string | null;
};

export type AvaSecondBrainMemory<TContent extends AvaCoreJson = AvaCoreJson> = {
  id: string;
  kind: AvaSecondBrainMemoryKind;
  summary: string;
  sourceReferences: AvaMemorySourceReference[];
  observedAt: string;
  validFrom: string | null;
  validUntil: string | null;
  confidence: number;
  status: AvaMemoryStatus;
  relatedEntities: AvaRelatedEntity[];
  supersedes: string | null;
  sensitive: boolean;
  conflicting: boolean;
  evidenceCount: number;
  content: TContent;
};

export type AvaCanonicalEntitySource = {
  source: string;
  sourceId: string;
};

export type AvaCanonicalEntity = {
  id: string;
  type: AvaEntityType;
  name: string;
  aliases: string[];
  sourceReferences: AvaCanonicalEntitySource[];
  relationships: AvaRelatedEntity[];
  confidence: number;
  status: "active" | "review" | "superseded";
  createdAt: string;
  updatedAt: string;
};

export type AvaIdentityCandidate = {
  candidateId: string;
  proposedEntityId: string | null;
  type: AvaEntityType;
  name: string;
  sourceReference: AvaCanonicalEntitySource;
  reason: string;
  confidence: number;
  status: "review" | "resolved" | "rejected";
};

export type AvaCanonicalRelationship = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationship: string;
  sourceReferences: AvaMemorySourceReference[];
  confidence: number;
  status: "active" | "review" | "superseded";
  observedAt: string;
};

export type AvaSupabaseLike = {
  from: (table: string) => {
    select: (columns?: string) => any;
    insert: (values: unknown) => any;
    upsert: (values: unknown, options?: unknown) => any;
    eq: (column: string, value: unknown) => any;
    order: (column: string, options?: unknown) => any;
    limit: (count: number) => any;
  };
};

export type AvaCognitiveState = {
  generatedAt: string;
  awareness: AvaAwarenessSnapshot;
  events: AvaEvent[];
  timeline: AvaEvent[];
  timelineSummary: AvaTimelineSummary;
  world: AvaWorldModel;
  attention: AvaAttentionScore[];
  reasoning: AvaReasoningOutput;
};

export type AvaPerceptionResult = {
  currentSnapshot: AvaCoreSnapshot;
  previousSnapshot: AvaCoreSnapshot | null;
  detectedChanges: AvaChange[];
  visibleChanges: AvaChange[];
  changeEvents: AvaEvent[];
  changeSummary: AvaChangeSummary;
};

export type AvaSystemStatus = "Calm" | "Focused" | "Busy" | "Attention Needed" | "Critical";

export type AvaFocusPlan = {
  topPriorities: AvaPriority[];
  secondaryPriorities: AvaPriority[];
  backgroundItems: AvaPriority[];
  futureWork: AvaPriority[];
};

export type AvaRecommendation = {
  id: string;
  title: string;
  summary: string;
  action: string;
  priority: "high" | "medium" | "low";
  source: AvaEventCategory;
};

export type AvaBriefVariant = "morning" | "afternoon" | "evening";

export type AvaDailyBriefOutput = {
  source: Record<string, unknown>;
  variant: AvaBriefVariant;
  summary: string;
  scheduleOverview: string;
  taskPriorities: string;
  weatherImpact: string;
  businessPulse: string;
  automationIssues: string;
  suggestedFocus: string;
  personalNotes: string;
};

export type AvaExecutiveContext = {
  generatedAt: string;
  missionStatus: AvaSystemStatus;
  topPriorities: AvaPriority[];
  focusItems: AvaFocusPlan;
  recentChanges: AvaChange[];
  activeRisks: AvaPriority[];
  businessSummary: string;
  personalSummary: string;
  automationSummary: string;
  calendarSummary: string;
  weatherSummary: string;
  pendingApprovals: AvaPriority[];
  recommendedActions: AvaRecommendation[];
  dailyBrief: AvaDailyBriefOutput;
  intelligenceFeed: Array<{
    id: string;
    timestamp: string;
    category: string;
    title: string;
    summary: string;
    severity: string;
    action: string;
  }>;
  raw: {
    cognitiveState: AvaCognitiveState;
    currentSnapshot: AvaCoreSnapshot;
    previousSnapshot: AvaCoreSnapshot | null;
    changeEvents: AvaEvent[];
  };
};
