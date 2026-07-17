import { storeAvaMemoryRecord } from "@/lib/ava/core/memory";
import type {
  AvaCoreJson,
  AvaMemorySourceReference,
  AvaRelatedEntity,
  AvaSecondBrainMemory,
  AvaSecondBrainMemoryKind,
  AvaSecondBrainMemoryScope,
  AvaSupabaseLike,
} from "@/lib/ava/core/types";

const SCOPE_BY_KIND: Record<AvaSecondBrainMemoryKind, AvaSecondBrainMemoryScope> = {
  working: "ava_working_memory",
  episode: "ava_episode",
  fact: "ava_fact",
  procedure: "ava_procedure",
  commitment: "ava_commitment",
  preference: "ava_preference",
  feedback: "ava_feedback",
  entity: "ava_entity",
  relationship: "ava_entity_relationship",
  identity_candidate: "ava_identity_candidate",
};

function clampConfidence(confidence: number) {
  return Math.min(1, Math.max(0, confidence));
}

function stableMemoryId(kind: AvaSecondBrainMemoryKind, summary: string, sourceReferences: AvaMemorySourceReference[]) {
  const evidence = sourceReferences
    .map((reference) => `${reference.source}:${reference.referenceId || ""}`)
    .sort()
    .join("|");
  const normalized = `${kind}:${summary}:${evidence}`
    .toLowerCase()
    .replace(/[^a-z0-9:|_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180);
  return normalized || `${kind}:${Date.now()}`;
}

export function createSecondBrainMemory<TContent extends AvaCoreJson = AvaCoreJson>({
  id,
  kind,
  summary,
  sourceReferences = [],
  observedAt = new Date().toISOString(),
  validFrom = null,
  validUntil = null,
  confidence = 1,
  status = "review",
  relatedEntities = [],
  supersedes = null,
  sensitive = false,
  conflicting = false,
  evidenceCount,
  content,
}: {
  id?: string;
  kind: AvaSecondBrainMemoryKind;
  summary: string;
  sourceReferences?: AvaMemorySourceReference[];
  observedAt?: string;
  validFrom?: string | null;
  validUntil?: string | null;
  confidence?: number;
  status?: AvaSecondBrainMemory<TContent>["status"];
  relatedEntities?: AvaRelatedEntity[];
  supersedes?: string | null;
  sensitive?: boolean;
  conflicting?: boolean;
  evidenceCount?: number;
  content: TContent;
}): AvaSecondBrainMemory<TContent> {
  const distinctEvidence = new Set(sourceReferences.map((reference) => `${reference.source}:${reference.referenceId || ""}`)).size;
  return {
    id: id || stableMemoryId(kind, summary, sourceReferences),
    kind,
    summary,
    sourceReferences,
    observedAt,
    validFrom,
    validUntil,
    confidence: clampConfidence(confidence),
    status,
    relatedEntities,
    supersedes,
    sensitive,
    conflicting,
    evidenceCount: evidenceCount ?? distinctEvidence,
    content,
  };
}

export function evaluateLearningPromotion<TContent extends AvaCoreJson>(memory: AvaSecondBrainMemory<TContent>) {
  const distinctEvidence = new Set(memory.sourceReferences.map((reference) => `${reference.source}:${reference.referenceId || ""}`)).size;
  const promotable = !memory.sensitive
    && !memory.conflicting
    && memory.confidence >= 0.9
    && Math.max(memory.evidenceCount, distinctEvidence) >= 2;
  return {
    promotable,
    status: promotable ? "active" as const : "review" as const,
    reasons: [
      ...(memory.sensitive ? ["Sensitive memories require review."] : []),
      ...(memory.conflicting ? ["Conflicting evidence requires review."] : []),
      ...(memory.confidence < 0.9 ? ["Confidence is below 0.90."] : []),
      ...(Math.max(memory.evidenceCount, distinctEvidence) < 2 ? ["Two independent supporting signals are required."] : []),
    ],
  };
}

export function promoteLearningMemory<TContent extends AvaCoreJson>(memory: AvaSecondBrainMemory<TContent>) {
  const evaluation = evaluateLearningPromotion(memory);
  return { ...memory, status: evaluation.status };
}

export async function writeSecondBrainMemory({
  supabase,
  ownerId,
  memory,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  memory: AvaSecondBrainMemory;
}) {
  return storeAvaMemoryRecord({
    supabase,
    ownerId,
    record: {
      scope: SCOPE_BY_KIND[memory.kind],
      memoryKey: memory.id,
      source: memory.sourceReferences[0]?.source || "ava-second-brain",
      confidence: memory.confidence,
      active: memory.status === "active",
      content: memory as unknown as AvaCoreJson,
    },
  });
}

export async function querySecondBrainMemory({
  supabase,
  ownerId,
  kind,
  active = true,
  limit = 20,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  kind: AvaSecondBrainMemoryKind;
  active?: boolean;
  limit?: number;
}): Promise<AvaSecondBrainMemory[]> {
  if (!supabase || !ownerId) return [];
  const { data } = await supabase
    .from("jarvis_memory")
    .select("memory_key,content,confidence,active,updated_at")
    .eq("owner_id", ownerId)
    .eq("scope", SCOPE_BY_KIND[kind])
    .eq("active", active)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data || []).map((row: { content?: unknown }) => row.content).filter(Boolean) as AvaSecondBrainMemory[];
}

export async function supersedeSecondBrainMemory({
  supabase,
  ownerId,
  previous,
  replacement,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  previous: AvaSecondBrainMemory;
  replacement: AvaSecondBrainMemory;
}) {
  const superseded = { ...previous, status: "superseded" as const };
  const next = { ...replacement, supersedes: previous.id };
  const [previousResult, replacementResult] = await Promise.all([
    writeSecondBrainMemory({ supabase, ownerId, memory: superseded }),
    writeSecondBrainMemory({ supabase, ownerId, memory: next }),
  ]);
  return { previous: previousResult, replacement: replacementResult };
}

export function createOutcomeMemory({
  actionId,
  action,
  outcome,
  status,
  source = "ava-action",
}: {
  actionId: string;
  action: string;
  outcome: string;
  status: "succeeded" | "failed" | "rejected" | "corrected";
  source?: string;
}) {
  return createSecondBrainMemory({
    id: `outcome:${actionId}:${status}`,
    kind: "episode",
    summary: `${action}: ${status}`,
    sourceReferences: [{ source, referenceId: actionId }],
    confidence: 1,
    status: "active",
    content: { actionId, action, outcome, status },
  });
}

export function createOutcomeMemories(input: Parameters<typeof createOutcomeMemory>[0]) {
  const episode = createOutcomeMemory(input);
  const feedback = createSecondBrainMemory({
    id: `feedback:${input.actionId}:${input.status}`,
    kind: "feedback",
    summary: `Action feedback: ${input.status}`,
    sourceReferences: [{ source: input.source || "ava-action", referenceId: input.actionId }],
    confidence: 1,
    status: "active",
    content: {
      actionId: input.actionId,
      status: input.status,
      outcome: input.outcome,
      learningEligible: false,
    },
  });
  return { episode, feedback };
}

export function createCommitmentMemory({
  commitmentId,
  summary,
  owner,
  dueAt = null,
  sourceReferences,
  relatedEntities = [],
}: {
  commitmentId: string;
  summary: string;
  owner: string;
  dueAt?: string | null;
  sourceReferences: AvaMemorySourceReference[];
  relatedEntities?: AvaRelatedEntity[];
}) {
  return createSecondBrainMemory({
    id: `commitment:${commitmentId}`,
    kind: "commitment",
    summary,
    sourceReferences,
    validFrom: new Date().toISOString(),
    validUntil: dueAt,
    confidence: 1,
    status: "active",
    relatedEntities,
    content: { commitmentId, owner, dueAt, state: "open" },
  });
}
