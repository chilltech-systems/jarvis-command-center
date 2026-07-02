import type { AvaChange, AvaRecommendation, AvaReasoningOutput } from "@/lib/ava/core/types";

export function buildRecommendations({
  reasoning,
  recentChanges,
}: {
  reasoning: AvaReasoningOutput;
  recentChanges: AvaChange[];
}): AvaRecommendation[] {
  const recommendations: AvaRecommendation[] = [];
  const firstRisk = reasoning.openRisks[0];
  const firstApproval = reasoning.pendingApprovals[0];
  const firstPriority = reasoning.topPriorities[0];
  const firstVisibleChange = recentChanges.find((change) => change.visibility === "user" && change.classification !== "Hidden");

  if (firstRisk) {
    recommendations.push({
      id: `risk:${firstRisk.id}`,
      title: "Review the active risk",
      summary: firstRisk.title,
      action: "Open the related system and clear the blocker.",
      priority: "high",
      source: "system",
    });
  }
  if (firstApproval) {
    recommendations.push({
      id: `approval:${firstApproval.id}`,
      title: "Handle the pending approval",
      summary: firstApproval.title,
      action: "Approve or deny the prepared action.",
      priority: "high",
      source: "approval",
    });
  }
  if (firstVisibleChange) {
    recommendations.push({
      id: `change:${firstVisibleChange.id}`,
      title: "Review what changed",
      summary: firstVisibleChange.summary,
      action: firstVisibleChange.recommendedAction,
      priority: firstVisibleChange.classification === "Important" || firstVisibleChange.classification === "Critical" ? "high" : "medium",
      source: firstVisibleChange.category,
    });
  }
  if (firstPriority) {
    recommendations.push({
      id: `focus:${firstPriority.id}`,
      title: "Protect the main focus",
      summary: firstPriority.title,
      action: "Use the next open block for this before adding more work.",
      priority: "medium",
      source: firstPriority.summary.split(" signal")[0] as AvaRecommendation["source"],
    });
  }

  return Array.from(new Map(recommendations.map((item) => [item.id, item])).values()).slice(0, 5);
}
