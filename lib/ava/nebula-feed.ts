import { readRecentAvaMemory } from "@/lib/ava/core/memory";
import type { AvaEvent, AvaExecutiveContext, AvaSeverity, AvaSupabaseLike } from "@/lib/ava/core/types";

export type AvaNebulaRegionId =
  | "awareness"
  | "memory"
  | "reasoning"
  | "attention"
  | "timeline"
  | "world-model"
  | "personal-context"
  | "business-systems"
  | "home-systems";

export type AvaNebulaSeverity = "critical" | "high" | "normal" | "low";

export type AvaNebulaEvent = {
  id: string;
  type: string;
  regionId: AvaNebulaRegionId;
  summary: string;
  timestamp: string;
  severity: AvaNebulaSeverity;
  source: string;
};

export type AvaNebulaEventPresentation = {
  intensity: number;
  tone: "calm" | "focus" | "warning" | "critical";
  shockwave: boolean;
  path: AvaNebulaRegionId[];
};

export type AvaNebulaEventV2 = AvaNebulaEvent & {
  presentation: AvaNebulaEventPresentation;
};

export type AvaNebulaRegion = {
  id: AvaNebulaRegionId;
  displayName: string;
  description: string;
  center: [number, number, number];
  activity: number;
  status: "active" | "watch" | "idle";
  eventCount: number;
  latestEvent: AvaNebulaEvent | null;
};

export type AvaNebulaSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  sourceMode: "live" | "degraded";
  runtimeHealth: {
    status: "healthy" | "warning" | "error";
    summary: string;
    liveSources: number;
    unavailableSources: number;
  };
  currentFocus: {
    regionId: AvaNebulaRegionId;
    summary: string;
  } | null;
  regions: AvaNebulaRegion[];
  recentEvents: AvaNebulaEvent[];
};

export type AvaNebulaMemory = {
  id: string;
  timestamp: string;
  summary: string;
  source: string;
  outcome: string;
  regionIds: AvaNebulaRegionId[];
  severity: AvaNebulaSeverity;
};

export type AvaNebulaRegionV2 = AvaNebulaRegion & {
  relatedRegionIds: AvaNebulaRegionId[];
  interpretation: string;
};

export type AvaNebulaSnapshotV2 = {
  schemaVersion: 2;
  generatedAt: string;
  sourceMode: "live" | "degraded";
  missionStatus: AvaExecutiveContext["missionStatus"];
  runtimeHealth: AvaNebulaSnapshot["runtimeHealth"];
  currentFocus: AvaNebulaSnapshot["currentFocus"];
  regions: AvaNebulaRegionV2[];
  recentEvents: AvaNebulaEventV2[];
  notableMemories: AvaNebulaMemory[];
};

let cachedMissionStatus: AvaExecutiveContext["missionStatus"] = "Calm";

const NEBULA_REGION_DEFS: Array<{
  id: AvaNebulaRegionId;
  displayName: string;
  description: string;
  center: [number, number, number];
  activity: number;
}> = [
  { id: "awareness", displayName: "Awareness", description: "Sensory attention across the current moment, active surroundings, and incoming context.", center: [-0.72, 0.36, 0.44], activity: 0.78 },
  { id: "memory", displayName: "Memory", description: "Stored patterns, past events, recovered references, and long-running operational context.", center: [0.72, -0.2, -0.3], activity: 0.66 },
  { id: "reasoning", displayName: "Reasoning", description: "Structured inference, prioritization, validation, and decision shaping.", center: [0.1, 0.66, -0.16], activity: 0.86 },
  { id: "attention", displayName: "Attention", description: "The active spotlight that ranks what matters now against the rest of the signal field.", center: [-0.16, 0, 0.82], activity: 0.74 },
  { id: "timeline", displayName: "Timeline", description: "Temporal ordering, deadlines, event traces, and near-future projection.", center: [-0.42, -0.62, -0.08], activity: 0.58 },
  { id: "world-model", displayName: "World Model", description: "AVA's structured map of systems, people, entities, relationships, and operating state.", center: [0.38, 0.14, 0.62], activity: 0.72 },
  { id: "personal-context", displayName: "Personal Context", description: "Private preferences, routines, priorities, and Cody-specific context.", center: [-0.8, -0.08, -0.38], activity: 0.62 },
  { id: "business-systems", displayName: "Business Systems", description: "CHILL TECH operations, client systems, reports, automations, and revenue-facing signals.", center: [0.18, -0.72, 0.38], activity: 0.81 },
  { id: "home-systems", displayName: "Home Systems", description: "Connected home telemetry, environment state, sensors, and background domestic awareness.", center: [0.78, 0.32, 0.06], activity: 0.54 },
];

const REGION_KEYWORDS: Array<{ id: AvaNebulaRegionId; values: string[] }> = [
  { id: "home-systems", values: ["home", "homeassistant", "device", "sensor", "room", "presence", "environmental", "media"] },
  { id: "business-systems", values: ["business", "project", "automation", "n8n", "slack", "revenue", "report"] },
  { id: "personal-context", values: ["personal", "person", "user", "conversation", "gmail", "todoist"] },
  { id: "attention", values: ["attention", "alert", "risk", "approval", "urgent", "critical", "focus"] },
  { id: "timeline", values: ["timeline", "calendar", "schedule", "deadline", "task", "scheduler"] },
  { id: "memory", values: ["memory", "snapshot", "history", "stored", "persistence"] },
  { id: "reasoning", values: ["reasoning", "recommendation", "decision", "priority", "cognition"] },
  { id: "world-model", values: ["world", "entity", "connection", "state", "change"] },
  { id: "awareness", values: ["awareness", "perception", "weather", "observation", "incoming"] },
];

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function regionForText(value: string): AvaNebulaRegionId {
  const normalized = value.toLowerCase();
  return REGION_KEYWORDS.find((region) => region.values.some((keyword) => normalized.includes(keyword)))?.id || "awareness";
}

function severityForEvent(severity: AvaSeverity): AvaNebulaSeverity {
  if (severity === "critical") return "critical";
  if (severity === "urgent" || severity === "warning") return "high";
  if (severity === "info") return "low";
  return "normal";
}

function normalizeEvent(event: AvaEvent): AvaNebulaEvent {
  const type = `${event.category}.${event.entityType}`;
  return {
    id: event.id,
    type,
    regionId: regionForText(`${event.source} ${event.category} ${event.entityType} ${event.summary}`),
    summary: event.summary,
    timestamp: event.timestamp,
    severity: severityForEvent(event.severity),
    source: event.source,
  };
}

function sourceCounts(context: AvaExecutiveContext) {
  return Object.values(context.raw.cognitiveState.awareness.sources).reduce(
    (counts, source) => {
      if (source.status === "live") counts.live += 1;
      if (source.status === "unavailable") counts.unavailable += 1;
      return counts;
    },
    { live: 0, unavailable: 0 },
  );
}

function healthForContext(context: AvaExecutiveContext) {
  if (context.missionStatus === "Critical") return "error" as const;
  if (context.missionStatus === "Attention Needed" || context.missionStatus === "Busy") return "warning" as const;
  return "healthy" as const;
}

function buildSnapshot(context: AvaExecutiveContext): AvaNebulaSnapshot {
  cachedMissionStatus = context.missionStatus;
  const generatedAt = new Date().toISOString();
  const events = [...context.raw.changeEvents, ...context.raw.cognitiveState.timeline]
    .map(normalizeEvent)
    .filter((event, index, all) => all.findIndex((candidate) => candidate.id === event.id) === index)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 18);
  const focusSummary = context.raw.cognitiveState.reasoning.suggestedFocus || "";
  const focusRegionId = focusSummary ? regionForText(focusSummary) : null;
  const counts = sourceCounts(context);
  const regions = NEBULA_REGION_DEFS.map<AvaNebulaRegion>((definition) => {
    const regionId = definition.id;
    const regionEvents = events.filter((event) => event.regionId === regionId);
    const eventEnergy = regionEvents.reduce((total, event) => {
      const ageMs = Math.max(0, Date.now() - new Date(event.timestamp).getTime());
      const recency = Math.exp(-ageMs / (15 * 60_000));
      const severity = event.severity === "critical" ? 0.42 : event.severity === "high" ? 0.3 : event.severity === "normal" ? 0.18 : 0.1;
      return total + recency * severity;
    }, 0);
    const activity = clamp(0.18 + definition.activity * 0.32 + Math.min(0.48, eventEnergy) + (focusRegionId === regionId ? 0.16 : 0));
    const watching = regionEvents.some((event) => event.severity === "critical" || event.severity === "high");

    return {
      id: regionId,
      displayName: definition.displayName,
      description: definition.description,
      center: definition.center,
      activity: Number(activity.toFixed(3)),
      status: watching ? "watch" : activity >= 0.52 ? "active" : "idle",
      eventCount: regionEvents.length,
      latestEvent: regionEvents[0] || null,
    };
  });

  return {
    schemaVersion: 1,
    generatedAt,
    sourceMode: counts.live > 0 ? "live" : "degraded",
    runtimeHealth: {
      status: healthForContext(context),
      summary: context.dailyBrief.suggestedFocus || context.raw.cognitiveState.reasoning.suggestedFocus || "AVA is monitoring current systems.",
      liveSources: counts.live,
      unavailableSources: counts.unavailable,
    },
    currentFocus: focusRegionId ? { regionId: focusRegionId, summary: focusSummary } : null,
    regions,
    recentEvents: events,
  };
}

function eventPresentation(event: AvaNebulaEvent): AvaNebulaEventPresentation {
  const destination = event.regionId;
  const path = ["awareness", "attention", "reasoning", destination]
    .filter((regionId, index, values) => values.indexOf(regionId) === index) as AvaNebulaRegionId[];
  const intensity = event.severity === "critical" ? 1 : event.severity === "high" ? 0.82 : event.severity === "normal" ? 0.58 : 0.34;
  return {
    intensity,
    tone: event.severity === "critical" ? "critical" : event.severity === "high" ? "warning" : destination === "reasoning" || destination === "attention" ? "focus" : "calm",
    shockwave: event.severity === "critical" || event.severity === "high",
    path,
  };
}

function interpretationForRegion(region: AvaNebulaRegion) {
  if (region.latestEvent) return `I'm ${region.status === "watch" ? "watching" : "processing"} ${region.latestEvent.summary.toLowerCase()}`;
  if (region.status === "active") return `I'm actively maintaining ${region.displayName.toLowerCase()} context.`;
  return `I'm keeping ${region.displayName.toLowerCase()} quiet in the background.`;
}

function relatedRegions(regionId: AvaNebulaRegionId): AvaNebulaRegionId[] {
  const relationships: Record<AvaNebulaRegionId, AvaNebulaRegionId[]> = {
    awareness: ["attention", "world-model"],
    memory: ["reasoning", "timeline"],
    reasoning: ["attention", "memory", "world-model"],
    attention: ["awareness", "reasoning"],
    timeline: ["memory", "personal-context"],
    "world-model": ["awareness", "business-systems", "home-systems"],
    "personal-context": ["timeline", "memory"],
    "business-systems": ["reasoning", "world-model"],
    "home-systems": ["awareness", "world-model"],
  };
  return relationships[regionId];
}

function memoryText(content: unknown, fallback: string) {
  if (!content || typeof content !== "object") return fallback;
  const value = content as Record<string, unknown>;
  return String(value.summary || value.headline || value.title || fallback);
}

function normalizeMemory(record: unknown, index: number): AvaNebulaMemory {
  const row = (record || {}) as { memory_key?: unknown; content?: unknown; updated_at?: unknown };
  const content = row.content && typeof row.content === "object" ? row.content as Record<string, unknown> : {};
  const summary = memoryText(content, `Notable memory ${index + 1}`);
  const severity = severityForEvent(String(content.severity || "info") as AvaSeverity);
  const regionId = regionForText(`${content.source || ""} ${content.category || ""} ${summary}`);
  return {
    id: String(row.memory_key || `memory-${index}`),
    timestamp: String(content.timestamp || row.updated_at || new Date(0).toISOString()),
    summary,
    source: String(content.source || "ava-memory"),
    outcome: String(content.recommendedAction || content.outcome || "Context retained for future reasoning."),
    regionIds: [regionId, "memory"].filter((id, position, all) => all.indexOf(id) === position) as AvaNebulaRegionId[],
    severity,
  };
}

export function getAvaNebulaSnapshot(context: AvaExecutiveContext) {
  return buildSnapshot(context);
}

export async function getAvaNebulaSnapshotV2({
  context,
  supabase,
  ownerId,
}: {
  context: AvaExecutiveContext;
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
}): Promise<AvaNebulaSnapshotV2> {
  const [snapshot, notableChanges, recentEvents] = await Promise.all([
    Promise.resolve(getAvaNebulaSnapshot(context)),
    readRecentAvaMemory({ supabase, ownerId, scope: "ava_core_notable_change", limit: 8 }),
    readRecentAvaMemory({ supabase, ownerId, scope: "ava_core_event", limit: 6 }),
  ]);
  const storedMemories = [...notableChanges, ...recentEvents]
    .map(normalizeMemory)
    .filter((memory, index, all) => all.findIndex((candidate) => candidate.id === memory.id) === index)
    .slice(0, 12);
  const notableMemories = storedMemories.length ? storedMemories : snapshot.recentEvents.slice(0, 10).map((event) => ({
    id: `recent-${event.id}`,
    timestamp: event.timestamp,
    summary: event.summary,
    source: event.source,
    outcome: "Retained from Ava's current cognitive timeline.",
    regionIds: [event.regionId, "memory"].filter((id, index, all) => all.indexOf(id) === index) as AvaNebulaRegionId[],
    severity: event.severity,
  }));

  return {
    schemaVersion: 2,
    generatedAt: snapshot.generatedAt,
    sourceMode: snapshot.sourceMode,
    missionStatus: cachedMissionStatus,
    runtimeHealth: snapshot.runtimeHealth,
    currentFocus: snapshot.currentFocus,
    regions: snapshot.regions.map((region) => ({
      ...region,
      relatedRegionIds: relatedRegions(region.id),
      interpretation: interpretationForRegion(region),
    })),
    recentEvents: snapshot.recentEvents.map((event) => ({ ...event, presentation: eventPresentation(event) })),
    notableMemories,
  };
}
