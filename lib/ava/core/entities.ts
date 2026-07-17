import type {
  AvaCanonicalEntity,
  AvaCanonicalEntitySource,
  AvaCanonicalRelationship,
  AvaEntityType,
  AvaIdentityCandidate,
  AvaRelatedEntity,
} from "@/lib/ava/core/types";
import { createSecondBrainMemory, writeSecondBrainMemory } from "@/lib/ava/core/second-brain-memory";
import type { AvaSupabaseLike } from "@/lib/ava/core/types";

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function canonicalEntityId(type: AvaEntityType, source: string, sourceId: string) {
  return `${normalized(type)}:${normalized(source)}:${normalized(sourceId)}`;
}

export function createCanonicalEntity({
  type,
  name,
  sourceReference,
  aliases = [],
  relationships = [],
  confidence = 1,
}: {
  type: AvaEntityType;
  name: string;
  sourceReference: AvaCanonicalEntitySource;
  aliases?: string[];
  relationships?: AvaRelatedEntity[];
  confidence?: number;
}): AvaCanonicalEntity {
  const now = new Date().toISOString();
  return {
    id: canonicalEntityId(type, sourceReference.source, sourceReference.sourceId),
    type,
    name,
    aliases: Array.from(new Set([name, ...aliases].map((alias) => alias.trim()).filter(Boolean))),
    sourceReferences: [sourceReference],
    relationships,
    confidence: Math.min(1, Math.max(0, confidence)),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export function resolveCanonicalEntity({
  type,
  name,
  sourceReference,
  aliases = [],
  existing = [],
}: {
  type: AvaEntityType;
  name: string;
  sourceReference: AvaCanonicalEntitySource;
  aliases?: string[];
  existing?: AvaCanonicalEntity[];
}): {
  resolution: "matched" | "created" | "candidate";
  entity: AvaCanonicalEntity | null;
  candidate: AvaIdentityCandidate | null;
} {
  const exact = existing.find((entity) => entity.type === type && entity.sourceReferences.some(
    (reference) => reference.source === sourceReference.source && reference.sourceId === sourceReference.sourceId,
  ));
  if (exact) return { resolution: "matched", entity: exact, candidate: null };

  const lookupAliases = new Set([name, ...aliases].map(normalized).filter(Boolean));
  const aliasMatches = existing.filter((entity) => entity.type === type && entity.aliases.some((alias) => lookupAliases.has(normalized(alias))));
  if (aliasMatches.length === 1) {
    const match = aliasMatches[0];
    return {
      resolution: "matched",
      entity: {
        ...match,
        aliases: Array.from(new Set([...match.aliases, name, ...aliases])),
        sourceReferences: [...match.sourceReferences, sourceReference],
        updatedAt: new Date().toISOString(),
      },
      candidate: null,
    };
  }
  if (aliasMatches.length > 1) {
    return {
      resolution: "candidate",
      entity: null,
      candidate: {
        candidateId: `candidate:${canonicalEntityId(type, sourceReference.source, sourceReference.sourceId)}`,
        proposedEntityId: null,
        type,
        name,
        sourceReference,
        reason: "An explicit alias matched more than one canonical entity.",
        confidence: 0,
        status: "review",
      },
    };
  }

  return {
    resolution: "created",
    entity: createCanonicalEntity({ type, name, sourceReference, aliases }),
    candidate: null,
  };
}

export function createCanonicalRelationship({
  fromEntityId,
  toEntityId,
  relationship,
  sourceReferences,
  confidence = 1,
  status = "active",
}: {
  fromEntityId: string;
  toEntityId: string;
  relationship: string;
  sourceReferences: AvaCanonicalRelationship["sourceReferences"];
  confidence?: number;
  status?: AvaCanonicalRelationship["status"];
}): AvaCanonicalRelationship {
  return {
    id: `relationship:${normalized(fromEntityId)}:${normalized(relationship)}:${normalized(toEntityId)}`,
    fromEntityId,
    toEntityId,
    relationship,
    sourceReferences,
    confidence: Math.min(1, Math.max(0, confidence)),
    status,
    observedAt: new Date().toISOString(),
  };
}

export async function writeCanonicalEntity({
  supabase,
  ownerId,
  entity,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  entity: AvaCanonicalEntity;
}) {
  const memory = createSecondBrainMemory({
    id: entity.id,
    kind: "entity",
    summary: `${entity.type}: ${entity.name}`,
    sourceReferences: entity.sourceReferences.map((reference) => ({ source: reference.source, referenceId: reference.sourceId })),
    confidence: entity.confidence,
    status: entity.status === "active" ? "active" : "review",
    relatedEntities: entity.relationships,
    content: entity,
  });
  return writeSecondBrainMemory({ supabase, ownerId, memory });
}

export async function writeCanonicalRelationship({
  supabase,
  ownerId,
  relationship,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  relationship: AvaCanonicalRelationship;
}) {
  const memory = createSecondBrainMemory({
    id: relationship.id,
    kind: "relationship",
    summary: `${relationship.fromEntityId} ${relationship.relationship} ${relationship.toEntityId}`,
    sourceReferences: relationship.sourceReferences,
    confidence: relationship.confidence,
    status: relationship.status === "active" ? "active" : "review",
    content: relationship,
  });
  return writeSecondBrainMemory({ supabase, ownerId, memory });
}

export async function writeIdentityCandidate({
  supabase,
  ownerId,
  candidate,
}: {
  supabase?: AvaSupabaseLike | null;
  ownerId?: string | null;
  candidate: AvaIdentityCandidate;
}) {
  const memory = createSecondBrainMemory({
    id: candidate.candidateId,
    kind: "identity_candidate",
    summary: candidate.reason,
    sourceReferences: [{ source: candidate.sourceReference.source, referenceId: candidate.sourceReference.sourceId }],
    confidence: candidate.confidence,
    status: candidate.status === "resolved" ? "resolved" : "review",
    content: candidate,
  });
  return writeSecondBrainMemory({ supabase, ownerId, memory });
}
