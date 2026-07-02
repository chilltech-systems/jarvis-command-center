import { createAvaChange } from "@/lib/ava/core/changes";
import type {
  AvaChange,
  AvaCoreJson,
  AvaCoreSnapshot,
  AvaEntityType,
  AvaWorldEntity,
} from "@/lib/ava/core/types";

const WEATHER_TEMPERATURE_THRESHOLD = 3;
const WEATHER_RAIN_THRESHOLD = 15;
const ATTENTION_PRIORITY_THRESHOLD = 2;

function asJson(value: unknown): AvaCoreJson {
  return JSON.parse(JSON.stringify(value ?? null)) as AvaCoreJson;
}

function taskStatus(entity: AvaWorldEntity) {
  const payload = entity.payload as { status?: unknown } | undefined;
  return typeof payload?.status === "string" ? payload.status : "";
}

function projectStatus(entity: AvaWorldEntity) {
  const payload = entity.payload as { status?: unknown } | undefined;
  return typeof payload?.status === "string" ? payload.status : "";
}

function numericPayload(entity: AvaWorldEntity, key: string) {
  const payload = entity.payload as Record<string, unknown> | undefined;
  const value = payload?.[key];
  return typeof value === "number" ? value : Number(value);
}

function entityMap(snapshot: AvaCoreSnapshot | null) {
  return snapshot?.world.entityIndex || {};
}

function isMeaningfulEntityChange(previous: AvaWorldEntity, current: AvaWorldEntity) {
  if (previous.currentState !== current.currentState) return true;
  if (previous.health !== current.health) return true;
  if (Math.abs(previous.priority - current.priority) >= ATTENTION_PRIORITY_THRESHOLD) return true;

  return false;
}

function changeForAddedEntity(current: AvaWorldEntity): AvaChange | null {
  if (current.type === "Task") {
    return createAvaChange({
      type: "task_added",
      category: "task",
      severity: current.health === "watch" ? "warning" : "normal",
      entityType: current.type,
      entityId: current.id,
      currentValue: asJson(current),
      summary: `Task appeared: ${current.currentState}`,
      recommendedAction: "Review the new task if it affects today's focus.",
    });
  }
  if (current.type === "CalendarEvent") {
    return createAvaChange({
      type: "calendar_added",
      category: "calendar",
      entityType: current.type,
      entityId: current.id,
      currentValue: asJson(current),
      summary: `Calendar event appeared: ${current.currentState}`,
      recommendedAction: "Check whether the schedule change affects the day plan.",
    });
  }

  return createAvaChange({
    type: "entity_added",
    category: "system",
    severity: current.health === "critical" || current.health === "at_risk" ? "warning" : "info",
    entityType: current.type,
    entityId: current.id,
    currentValue: asJson(current),
    summary: `${current.type} appeared: ${current.currentState}`,
    recommendedAction: "Keep this as background context.",
    visibility: current.health === "healthy" ? "internal" : "user",
  });
}

function changeForRemovedEntity(previous: AvaWorldEntity): AvaChange | null {
  if (previous.type === "Task") {
    return createAvaChange({
      type: taskStatus(previous) === "completed" ? "task_completed" : "task_removed",
      category: "task",
      severity: "info",
      entityType: previous.type,
      entityId: previous.id,
      previousValue: asJson(previous),
      summary: taskStatus(previous) === "completed" ? `Task completed: ${previous.currentState}` : `Task no longer appears: ${previous.currentState}`,
      recommendedAction: "No action needed unless this was unexpected.",
    });
  }
  if (previous.type === "CalendarEvent") {
    return createAvaChange({
      type: "calendar_removed",
      category: "calendar",
      severity: "info",
      entityType: previous.type,
      entityId: previous.id,
      previousValue: asJson(previous),
      summary: `Calendar event no longer appears: ${previous.currentState}`,
      recommendedAction: "Review the schedule if this was unexpected.",
    });
  }

  return createAvaChange({
    type: "entity_removed",
    category: "system",
    severity: "info",
    entityType: previous.type,
    entityId: previous.id,
    previousValue: asJson(previous),
    summary: `${previous.type} no longer appears: ${previous.currentState}`,
    recommendedAction: "No action needed.",
    visibility: "internal",
  });
}

function changeForWeather(previous: AvaWorldEntity, current: AvaWorldEntity): AvaChange[] {
  const changes: AvaChange[] = [];
  const previousTemperature = numericPayload(previous, "temperature");
  const currentTemperature = numericPayload(current, "temperature");
  const previousRain = numericPayload(previous, "rainChance");
  const currentRain = numericPayload(current, "rainChance");
  const previousCondition = String((previous.payload as { condition?: unknown } | undefined)?.condition || "");
  const currentCondition = String((current.payload as { condition?: unknown } | undefined)?.condition || "");

  if (Number.isFinite(previousTemperature) && Number.isFinite(currentTemperature) && Math.abs(currentTemperature - previousTemperature) >= WEATHER_TEMPERATURE_THRESHOLD) {
    changes.push(createAvaChange({
      type: "temperature_changed",
      category: "weather",
      severity: Math.abs(currentTemperature - previousTemperature) >= 8 ? "warning" : "normal",
      entityType: "Weather",
      entityId: current.id,
      previousValue: previousTemperature,
      currentValue: currentTemperature,
      summary: `Temperature changed from ${previousTemperature} to ${currentTemperature}.`,
      recommendedAction: "Adjust outdoor or travel plans only if needed.",
    }));
  }

  if (previousCondition !== currentCondition || (Number.isFinite(previousRain) && Number.isFinite(currentRain) && Math.abs(currentRain - previousRain) >= WEATHER_RAIN_THRESHOLD)) {
    changes.push(createAvaChange({
      type: "weather_changed",
      category: "weather",
      severity: current.health === "watch" || current.health === "at_risk" ? "warning" : "normal",
      entityType: "Weather",
      entityId: current.id,
      previousValue: asJson({ condition: previousCondition, rainChance: previousRain }),
      currentValue: asJson({ condition: currentCondition, rainChance: currentRain }),
      summary: `Weather changed from ${previousCondition || "unknown"} to ${currentCondition || "unknown"}.`,
      recommendedAction: "Protect timing if the forecast is getting worse.",
    }));
  }

  return changes;
}

function changeForUpdatedEntity(previous: AvaWorldEntity, current: AvaWorldEntity): AvaChange[] {
  if (!isMeaningfulEntityChange(previous, current)) return [];
  if (current.type === "Weather") return changeForWeather(previous, current);

  if (current.type === "Project" && projectStatus(previous) !== projectStatus(current)) {
    return [createAvaChange({
      type: "project_status_changed",
      category: "project",
      entityType: current.type,
      entityId: current.id,
      previousValue: projectStatus(previous),
      currentValue: projectStatus(current),
      summary: `Project status changed for ${current.name}.`,
      recommendedAction: "Review the next action if the project changed phase.",
    })];
  }

  if (current.type === "Automation") {
    if (previous.health !== "at_risk" && previous.health !== "critical" && (current.health === "at_risk" || current.health === "critical")) {
      return [createAvaChange({
        type: "automation_failed",
        category: "automation",
        severity: "urgent",
        classification: "Critical",
        entityType: current.type,
        entityId: current.id,
        previousValue: asJson(previous),
        currentValue: asJson(current),
        summary: `Automation needs attention: ${current.currentState}`,
        recommendedAction: "Review the failed or warning automation path.",
      })];
    }
    if ((previous.health === "at_risk" || previous.health === "critical") && current.health === "healthy") {
      return [createAvaChange({
        type: "automation_recovered",
        category: "automation",
        severity: "info",
        entityType: current.type,
        entityId: current.id,
        previousValue: asJson(previous),
        currentValue: asJson(current),
        summary: `Automation recovered: ${current.name}`,
        recommendedAction: "No action needed.",
      })];
    }
  }

  if (previous.health === "healthy" && current.health !== "healthy") {
    return [createAvaChange({
      type: "risk_introduced",
      category: "system",
      severity: current.health === "critical" || current.health === "at_risk" ? "urgent" : "warning",
      entityType: current.type,
      entityId: current.id,
      previousValue: asJson(previous),
      currentValue: asJson(current),
      summary: `Risk appeared for ${current.name}.`,
      recommendedAction: "Review the new risk signal.",
    })];
  }

  if (previous.health !== "healthy" && current.health === "healthy") {
    return [createAvaChange({
      type: "risk_cleared",
      category: "system",
      severity: "info",
      entityType: current.type,
      entityId: current.id,
      previousValue: asJson(previous),
      currentValue: asJson(current),
      summary: `Risk cleared for ${current.name}.`,
      recommendedAction: "No action needed.",
    })];
  }

  return [createAvaChange({
    type: "entity_changed",
    category: "system",
    severity: current.health === "healthy" ? "info" : "normal",
    entityType: current.type,
    entityId: current.id,
    previousValue: asJson(previous),
    currentValue: asJson(current),
    summary: `${current.name} changed.`,
    recommendedAction: "Keep this as background context.",
    visibility: current.health === "healthy" ? "internal" : "user",
  })];
}

export function diffAvaSnapshots(previousSnapshot: AvaCoreSnapshot | null, currentSnapshot: AvaCoreSnapshot): AvaChange[] {
  if (!previousSnapshot) return [];

  const previousEntities = entityMap(previousSnapshot);
  const currentEntities = entityMap(currentSnapshot);
  const changes: AvaChange[] = [];

  for (const [id, current] of Object.entries(currentEntities)) {
    const previous = previousEntities[id];
    if (!previous) {
      const change = changeForAddedEntity(current);
      if (change) changes.push(change);
      continue;
    }

    changes.push(...changeForUpdatedEntity(previous, current));
  }

  for (const [id, previous] of Object.entries(previousEntities)) {
    if (currentEntities[id]) continue;
    const change = changeForRemovedEntity(previous);
    if (change) changes.push(change);
  }

  const previousPriorityCount = previousSnapshot.reasoningSummary.topPriorityCount;
  const currentPriorityCount = currentSnapshot.reasoningSummary.topPriorityCount;
  if (currentPriorityCount - previousPriorityCount >= ATTENTION_PRIORITY_THRESHOLD) {
    changes.push(createAvaChange({
      type: "attention_priority_increased",
      category: "system",
      severity: "warning",
      entityType: "System" as AvaEntityType,
      entityId: "ava-attention",
      previousValue: previousPriorityCount,
      currentValue: currentPriorityCount,
      summary: `${currentPriorityCount - previousPriorityCount} new priorities appeared.`,
      recommendedAction: "Review Ava's top priorities.",
    }));
  }

  return filterStableChanges(changes);
}

export function filterStableChanges(changes: AvaChange[]) {
  const unique = new Map<string, AvaChange>();

  for (const change of changes) {
    if (change.confidence < 0.5) continue;
    if (change.classification === "Hidden" && change.visibility === "user") continue;
    unique.set(change.id, change);
  }

  return Array.from(unique.values());
}
