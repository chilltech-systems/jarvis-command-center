export type PermissionLevel = "read_only" | "draft" | "requires_approval" | "execute";

export type ToolStatus = "available" | "credential_needed" | "planned";

export type IntegrationStatus =
  | "Connected"
  | "Credential Needed"
  | "Ready To Configure"
  | "In Progress"
  | "Complete"
  | "Future";

export type JarvisToolDefinition = {
  name: string;
  description: string;
  category: string;
  permission: PermissionLevel;
  status: ToolStatus;
  integration: string;
  approvalAction?: string;
};

export type JarvisIntegration = {
  key: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  permission: PermissionLevel;
  credentialEnvironmentKeys: string[];
  capabilities: string[];
  notes: string;
};

export type AssistantApproval = {
  id?: string;
  action: string;
  target: string;
  expectedResult: string;
  status: "pending";
};

export type AssistantResponse = {
  conversationId?: string;
  message: string;
  tool?: JarvisToolDefinition;
  approval?: AssistantApproval;
  activity: string;
};
