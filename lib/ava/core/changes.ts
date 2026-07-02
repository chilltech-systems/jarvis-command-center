import { createAvaEvent } from "@/lib/ava/core/events";
import type {
  AvaChange,
  AvaChangeClassification,
  AvaChangeSummary,
  AvaCoreJson,
  AvaEntityType,
  AvaEvent,
  AvaEventCategory,
  AvaSeverity,
  AvaVisibility,
} from "@/lib/ava/core/types";

type ChangeInput = {
  type: AvaChange["type"];
  category: AvaEventCategory;
  severity?: AvaSeverity;
  classification?: AvaChangeClassification;
  entityType: AvaEntityType;
  entityId: string;
  previousValue?: AvaCoreJson;
  currentValue?: AvaCoreJson;
  summary: string;
  recommendedAction?: string;
  confidence?: number;
  visibility?: AvaVisibility;
  timestamp?: string;
};

function stableChangeId(input: ChangeInput) {
  return [
    "change",
    input.type,
    input.entityType,
    input.entityId,
    input.summary.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  ].filter(Boolean).join(":");
}

export function classifyChange(severity: AvaSeverity, visibility: AvaVisibility): AvaChangeClassification {
  if (visibility === "internal") return "Hidden";
  if (severity === "critical" || severity === "urgent") return "Critical";
  if (severity === "warning") return "Important";
  if (severity === "normal") return "Minor";

  return "Informational";
}

export function createAvaChange(input: ChangeInput): AvaChange {
  const severity = input.severity || "normal";
  const visibility = input.visibility || "user";

  return {
    id: stableChangeId(input),
    timestamp: input.timestamp || new Date().toISOString(),
    type: input.type,
    category: input.category,
    severity,
    classification: input.classification || classifyChange(severity, visibility),
    affectedEntity: {
      type: input.entityType,
      id: input.entityId,
    },
    previousValue: input.previousValue ?? null,
    currentValue: input.currentValue ?? null,
    summary: input.summary,
    recommendedAction: input.recommendedAction || "Review when relevant.",
    confidence: input.confidence ?? 0.9,
    visibility,
  };
}

export function changeToEvent(change: AvaChange): AvaEvent {
  return createAvaEvent({
    id: `change-event:${change.id}`,
    timestamp: change.timestamp,
    source: "system",
    category: "change",
    severity: change.severity,
    entityType: "Change",
    entityId: change.id,
    summary: change.summary,
    payload: change as unknown as AvaCoreJson,
    relatedEntities: [{
      type: change.affectedEntity.type,
      id: change.affectedEntity.id,
      relationship: "changed",
    }],
    visibility: change.visibility,
  });
}

export function summarizeChanges(changes: AvaChange[]): AvaChangeSummary {
  const visible = changes.filter((change) => change.visibility === "user" && change.classification !== "Hidden");
  const byClassification = changes.reduce<AvaChangeSummary["byClassification"]>((counts, change) => ({
    ...counts,
    [change.classification]: (counts[change.classification] || 0) + 1,
  }), {});
  const byCategory = changes.reduce<AvaChangeSummary["byCategory"]>((counts, change) => ({
    ...counts,
    [change.category]: (counts[change.category] || 0) + 1,
  }), {});
  const completedTasks = visible.filter((change) => change.type === "task_completed").length;
  const introducedRisks = visible.filter((change) => change.type === "risk_introduced" || ["critical", "urgent", "warning"].includes(change.severity)).length;
  const clearedRisks = visible.filter((change) => change.type === "risk_cleared" || change.type === "automation_recovered").length;
  const sentences = [
    completedTasks ? `${completedTasks} task${completedTasks === 1 ? " was" : "s were"} completed since the last snapshot.` : "",
    introducedRisks ? `${introducedRisks} new priority signal${introducedRisks === 1 ? "" : "s"} appeared.` : "",
    clearedRisks ? `${clearedRisks} risk signal${clearedRisks === 1 ? "" : "s"} cleared.` : "",
  ].filter(Boolean);

  return {
    total: changes.length,
    visible: visible.length,
    byClassification,
    byCategory,
    sentences,
    headline: sentences[0] || (visible.length ? `${visible.length} meaningful change${visible.length === 1 ? "" : "s"} detected.` : "No meaningful changes detected."),
  };
}
