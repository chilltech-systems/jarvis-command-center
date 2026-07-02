import type {
  AvaEvent,
  AvaSeverity,
  AvaTimelineFilter,
  AvaTimelineGroup,
  AvaTimelineSummary,
} from "@/lib/ava/core/types";

const SEVERITY_WEIGHT: Record<AvaSeverity, number> = {
  critical: 5,
  urgent: 4,
  warning: 3,
  normal: 2,
  info: 1,
};

export function severityWeight(severity: AvaSeverity) {
  return SEVERITY_WEIGHT[severity] || 0;
}

export function compareEventsDescending(first: AvaEvent, second: AvaEvent) {
  const timeDifference = Date.parse(second.timestamp) - Date.parse(first.timestamp);
  if (timeDifference) return timeDifference;

  const severityDifference = severityWeight(second.severity) - severityWeight(first.severity);
  if (severityDifference) return severityDifference;

  return first.id.localeCompare(second.id);
}

export function mergeTimelineEvents(...eventGroups: AvaEvent[][]) {
  const merged = new Map<string, AvaEvent>();

  for (const event of eventGroups.flat()) {
    merged.set(event.id, event);
  }

  return Array.from(merged.values()).sort(compareEventsDescending);
}

export function mergeObservationAndChangeEvents(observationEvents: AvaEvent[], changeEvents: AvaEvent[]) {
  return mergeTimelineEvents(observationEvents, changeEvents);
}

export function filterTimeline(events: AvaEvent[], filter: AvaTimelineFilter = {}) {
  const since = filter.since ? Date.parse(filter.since) : null;
  const until = filter.until ? Date.parse(filter.until) : null;

  return events.filter((event) => {
    const timestamp = Date.parse(event.timestamp);
    if (filter.sources && !filter.sources.includes(event.source)) return false;
    if (filter.categories && !filter.categories.includes(event.category)) return false;
    if (filter.severities && !filter.severities.includes(event.severity)) return false;
    if (filter.entityTypes && !filter.entityTypes.includes(event.entityType)) return false;
    if (filter.visibility && event.visibility !== filter.visibility) return false;
    if (since !== null && timestamp < since) return false;
    if (until !== null && timestamp > until) return false;

    return true;
  });
}

export function groupTimelineBy(events: AvaEvent[], getKey: (event: AvaEvent) => string): AvaTimelineGroup[] {
  const groups = new Map<string, AvaEvent[]>();

  for (const event of events) {
    const key = getKey(event);
    groups.set(key, [...(groups.get(key) || []), event]);
  }

  return Array.from(groups.entries()).map(([key, groupEvents]) => ({
    key,
    events: groupEvents.sort(compareEventsDescending),
    count: groupEvents.length,
    highestSeverity: highestSeverity(groupEvents),
  }));
}

export function highestSeverity(events: AvaEvent[]) {
  return events.reduce<AvaSeverity>((highest, event) => (
    severityWeight(event.severity) > severityWeight(highest) ? event.severity : highest
  ), "info");
}

export function summarizeTimeline(events: AvaEvent[]): AvaTimelineSummary {
  return {
    total: events.length,
    byCategory: events.reduce<AvaTimelineSummary["byCategory"]>((counts, event) => ({
      ...counts,
      [event.category]: (counts[event.category] || 0) + 1,
    }), {}),
    bySeverity: events.reduce<AvaTimelineSummary["bySeverity"]>((counts, event) => ({
      ...counts,
      [event.severity]: (counts[event.severity] || 0) + 1,
    }), {}),
    highestSeverity: highestSeverity(events),
    latestEventAt: events[0]?.timestamp || null,
  };
}

export function prioritizeTimeline(events: AvaEvent[], limit = 10) {
  return [...events]
    .sort((first, second) => {
      const severityDifference = severityWeight(second.severity) - severityWeight(first.severity);
      if (severityDifference) return severityDifference;

      return compareEventsDescending(first, second);
    })
    .slice(0, limit);
}
