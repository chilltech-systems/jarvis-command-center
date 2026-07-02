import type { AvaChange, AvaReasoningOutput, AvaSystemStatus, AvaTimelineSummary } from "@/lib/ava/core/types";

export function determineAvaStatus({
  reasoning,
  timelineSummary,
  recentChanges,
}: {
  reasoning: AvaReasoningOutput;
  timelineSummary: AvaTimelineSummary;
  recentChanges: AvaChange[];
}): AvaSystemStatus {
  const criticalChanges = recentChanges.filter((change) => change.classification === "Critical").length;
  const importantChanges = recentChanges.filter((change) => change.classification === "Important").length;

  if (timelineSummary.bySeverity.critical || criticalChanges > 0) return "Critical";
  if ((timelineSummary.bySeverity.urgent || 0) > 0 || reasoning.openRisks.length >= 3) return "Attention Needed";
  if (importantChanges > 0 || reasoning.pendingApprovals.length > 0) return "Busy";
  if (reasoning.topPriorities.length > 0) return "Focused";

  return "Calm";
}
