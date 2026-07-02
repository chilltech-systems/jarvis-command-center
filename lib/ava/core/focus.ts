import type { AvaChange, AvaFocusPlan, AvaPriority, AvaReasoningOutput } from "@/lib/ava/core/types";

function changePriority(change: AvaChange): AvaPriority {
  const score = change.classification === "Critical" ? 90 : change.classification === "Important" ? 70 : change.classification === "Minor" ? 45 : 20;

  return {
    id: change.id,
    title: change.summary,
    summary: change.recommendedAction,
    severity: change.severity,
    entityType: change.affectedEntity.type,
    entityId: change.affectedEntity.id,
    score,
  };
}

function uniquePriorities(priorities: AvaPriority[]) {
  return Array.from(new Map(priorities.map((priority) => [priority.id, priority])).values())
    .sort((first, second) => second.score - first.score || first.title.localeCompare(second.title));
}

export function buildFocusPlan(reasoning: AvaReasoningOutput, recentChanges: AvaChange[]): AvaFocusPlan {
  const changePriorities = recentChanges
    .filter((change) => change.visibility === "user" && change.classification !== "Hidden")
    .map(changePriority);
  const allPriorities = uniquePriorities([...reasoning.topPriorities, ...changePriorities]);

  return {
    topPriorities: allPriorities.slice(0, 3),
    secondaryPriorities: allPriorities.slice(3, 6),
    backgroundItems: allPriorities.filter((priority) => priority.score < 40).slice(0, 4),
    futureWork: reasoning.topPriorities.filter((priority) => priority.score < 65).slice(0, 4),
  };
}
