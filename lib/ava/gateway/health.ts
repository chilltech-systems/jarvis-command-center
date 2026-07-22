import "server-only";
import type { AvaCapabilityDefinition, AvaCapabilityHealth, AvaSourceHealth } from "@/lib/ava/gateway/types";
import { toolHubConfigured, toolHubServiceConnected, toolHubToolEnabled } from "@/lib/jarvis/tool-hub";

const TOOL_SERVICE: Record<string, string> = {
  "todoist.list": "todoist",
  "todoist.create": "todoist",
  "todoist.complete": "todoist",
  "gmail.search": "gmail",
  "gmail.send": "gmail",
  "calendar.list": "googleCalendar",
  "calendar.create": "googleCalendar",
  "sheets.read": "googleSheets",
  "sheets.write": "googleSheets",
};

function hostedToolAllowlist() {
  return new Set((process.env.AVA_LIVE_TOOL_HUB_TOOLS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean));
}

export function capabilityHealth(definition: AvaCapabilityDefinition, now = new Date()): AvaCapabilityHealth {
  const checkedAt = now.toISOString();
  if (definition.status !== "available") {
    return { name: definition.name, integration: definition.integration, permission: definition.permission, available: false, credentialReady: false, handlerReady: false, reason: "Capability is not enabled for production.", checkedAt };
  }
  if (!definition.toolHubTool) {
    return { name: definition.name, integration: definition.integration, permission: definition.permission, available: true, credentialReady: true, handlerReady: true, reason: null, checkedAt };
  }

  const allowlist = hostedToolAllowlist();
  const explicitlyEnabled = allowlist.has(definition.toolHubTool);
  const registryEnabled = toolHubToolEnabled(definition.toolHubTool);
  const service = TOOL_SERVICE[definition.toolHubTool];
  const credentialReady = allowlist.size > 0
    ? explicitlyEnabled
    : Boolean(service && toolHubServiceConnected(service));
  const handlerReady = allowlist.size > 0 ? explicitlyEnabled : registryEnabled;
  const configured = toolHubConfigured();
  const available = configured && credentialReady && handlerReady;
  const reason = available
    ? null
    : !configured
      ? "Ava Tool Hub is not configured."
      : !credentialReady
        ? "The required source credential is not verified."
        : "The production Tool Hub handler is not enabled.";
  return { name: definition.name, integration: definition.integration, permission: definition.permission, available, credentialReady, handlerReady, reason, checkedAt };
}

export function capabilityHealthSnapshot(definitions: AvaCapabilityDefinition[]) {
  const now = new Date();
  return definitions.map((definition) => capabilityHealth(definition, now));
}

export function dailySourceHealth({
  generatedAt,
  snapshotAgeMs,
  freshness,
  sourceStatus,
}: {
  generatedAt: string;
  snapshotAgeMs: number;
  freshness: "fresh" | "stale" | "fallback";
  sourceStatus: Record<string, { status: "success" | "failed"; error: string | null }>;
}): AvaSourceHealth[] {
  return Object.entries(sourceStatus).map(([source, state]) => ({
    source,
    status: state.status === "failed" ? (freshness === "fallback" ? "unavailable" : "fallback") : freshness === "fresh" ? "connected" : "stale",
    lastSuccessAt: state.status === "success" ? generatedAt : null,
    lastError: state.error,
    ageMs: snapshotAgeMs,
  }));
}
