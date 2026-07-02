import type {
  AvaAttentionScore,
  AvaCognitiveState,
  AvaCoreSnapshot,
  AvaSnapshotSummary,
} from "@/lib/ava/core/types";

function countAttention(attention: AvaAttentionScore[]): AvaSnapshotSummary["attention"] {
  return attention.reduce<AvaSnapshotSummary["attention"]>((counts, item) => {
    if (item.band === "Critical") counts.critical += 1;
    if (item.band === "High") counts.high += 1;
    if (item.band === "Medium") counts.medium += 1;
    if (item.band === "Background") counts.background += 1;
    if (item.band === "Ignore") counts.ignore += 1;

    return counts;
  }, {
    critical: 0,
    high: 0,
    medium: 0,
    background: 0,
    ignore: 0,
  });
}

export function buildAvaSnapshot(state: AvaCognitiveState): AvaCoreSnapshot {
  return {
    id: `ava-core-snapshot:${state.generatedAt}`,
    timestamp: state.generatedAt,
    awareness: state.awareness,
    world: state.world,
    timelineSummary: state.timelineSummary,
    reasoningSummary: {
      topPriorityCount: state.reasoning.topPriorities.length,
      openRiskCount: state.reasoning.openRisks.length,
      pendingApprovalCount: state.reasoning.pendingApprovals.length,
      suggestedFocus: state.reasoning.suggestedFocus,
    },
    attentionSummary: countAttention(state.attention),
  };
}

export function parseAvaSnapshot(value: unknown): AvaCoreSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Partial<AvaCoreSnapshot>;

  if (
    typeof snapshot.id !== "string"
    || typeof snapshot.timestamp !== "string"
    || !snapshot.awareness
    || !snapshot.world
    || !snapshot.timelineSummary
    || !snapshot.reasoningSummary
    || !snapshot.attentionSummary
  ) {
    return null;
  }

  return snapshot as AvaCoreSnapshot;
}

export function serializeAvaSnapshot(snapshot: AvaCoreSnapshot) {
  return JSON.parse(JSON.stringify(snapshot)) as AvaCoreSnapshot;
}
