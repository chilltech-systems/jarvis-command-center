import type { PermissionLevel, ToolStatus } from "@/lib/jarvis/types";

export type AvaContextLayer = {
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  name: string;
  summary: string[];
};

export type AvaContextEnvelope = {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  freshness: "fresh" | "stale" | "fallback";
  sourceAgeMs: number;
  criticalNotice: string | null;
  sources: AvaSourceHealth[];
  capabilityHealth: AvaCapabilityHealth[];
  executionBudget: AvaExecutionBudget;
  layers: AvaContextLayer[];
  promptContext: string;
};

export type AvaSourceHealth = {
  source: string;
  status: "connected" | "stale" | "fallback" | "unavailable";
  lastSuccessAt: string | null;
  lastError: string | null;
  ageMs: number | null;
};

export type AvaCapabilityHealth = {
  name: string;
  integration: string;
  permission: PermissionLevel;
  available: boolean;
  credentialReady: boolean;
  handlerReady: boolean;
  reason: string | null;
  checkedAt: string;
};

export type AvaExecutionBudget = {
  centralDate: string;
  dailyLimit: number;
  reservedExecutions: number;
  remainingExecutions: number;
  stopEngaged: boolean;
  categories: {
    scheduledContext: number;
    retry: number;
    explicitRead: number;
    approvedAction: number;
    monitoring: number;
    unrelated: number;
  };
};

export type AvaJsonSchema = {
  type: "object";
  properties: Record<string, {
    type: "string" | "number" | "boolean" | "array" | "object";
    description?: string;
    enum?: string[];
    items?: { type: "string" | "number" | "boolean" | "object" };
  }>;
  required?: string[];
  additionalProperties?: boolean;
};

export type AvaCapabilityDefinition = {
  name: string;
  description: string;
  category: string;
  permission: PermissionLevel;
  status: ToolStatus;
  integration: string;
  parameters: AvaJsonSchema;
  approvalAction?: string;
  toolHubTool?: string;
};

export type AvaRealtimeTool = {
  type: "function";
  name: string;
  description: string;
  parameters: AvaJsonSchema;
};

export type AvaGatewayIdentity = {
  ownerId: string;
  email: string;
};

export type AvaToolResult = {
  status: "complete" | "approval_required" | "failed" | "unavailable";
  message: string;
  data?: unknown;
  toolCallId?: string;
  approval?: {
    id: string;
    action: string;
    target: string;
    expectedResult: string;
    expiresAt: string;
  };
};
