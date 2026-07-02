import { severityWeight } from "@/lib/ava/core/timeline";
import type { AvaAttentionBand, AvaAttentionScore, AvaEvent } from "@/lib/ava/core/types";

function bandForScore(score: number): AvaAttentionBand {
  if (score >= 85) return "Critical";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";
  if (score >= 15) return "Background";
  return "Ignore";
}

function hoursOld(timestamp: string) {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return 999;

  return Math.max(0, (Date.now() - parsed) / 36e5);
}

export function scoreEventAttention(event: AvaEvent): AvaAttentionScore {
  const reasons: string[] = [];
  let score = severityWeight(event.severity) * 15;

  if (["critical", "urgent"].includes(event.severity)) reasons.push("high severity");
  if (event.category === "approval") {
    score += 20;
    reasons.push("approval required");
  }
  if (event.category === "automation" || event.category === "business") {
    score += 12;
    reasons.push("operational impact");
  }
  if (event.category === "task" && /overdue|priority/i.test(`${event.summary} ${JSON.stringify(event.payload)}`)) {
    score += 12;
    reasons.push("task pressure");
  }
  if (event.category === "email" && event.severity !== "info") {
    score += 10;
    reasons.push("communication attention");
  }
  if (hoursOld(event.timestamp) <= 4) {
    score += 8;
    reasons.push("recent signal");
  }
  if (event.visibility === "internal") score -= 8;

  const normalizedScore = Math.max(0, Math.min(100, score));

  return {
    eventId: event.id,
    score: normalizedScore,
    band: bandForScore(normalizedScore),
    reasons: reasons.length ? reasons : ["background context"],
  };
}

export function scoreTimelineAttention(events: AvaEvent[]) {
  return events
    .map(scoreEventAttention)
    .sort((first, second) => second.score - first.score || first.eventId.localeCompare(second.eventId));
}
