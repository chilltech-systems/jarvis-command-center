import type { JarvisToolDefinition } from "@/lib/jarvis/types";

export function toolCanRunWithoutApproval(tool: JarvisToolDefinition) {
  return tool.permission === "read_only" || tool.permission === "draft";
}

export function approvalForTool(tool: JarvisToolDefinition, target: string) {
  return {
    action: tool.approvalAction ?? tool.description,
    target,
    expectedResult: tool.description,
    status: "pending" as const,
  };
}
