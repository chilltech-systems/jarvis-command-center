const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const errors = [];

const component = read("app/components/jarvis-assistant.tsx");
const assistantRoute = read("app/api/jarvis/assistant/route.ts");
const approvalRoute = read("app/api/jarvis/approvals/route.ts");
const tools = read("lib/jarvis/tool-registry.ts");
const integrations = read("lib/jarvis/integrations.ts");
const openai = read("lib/jarvis/openai.ts");
const migration = read("supabase/migrations/20260615000100_jarvis_assistant_phase1.sql");

for (const value of ["jarvis-orb", "assistant-panel", "localStorage", "approval-card", "Integration inventory"]) {
  if (!component.includes(value)) errors.push(`assistant UI is missing ${value}`);
}

for (const tool of [
  "get_n8n_status", "run_n8n_workflow", "get_recent_emails", "draft_email",
  "get_calendar_events", "draft_calendar_event", "get_business_metrics",
  "search_project_knowledge", "create_codex_task", "send_slack_message",
]) {
  if (!tools.includes(tool)) errors.push(`tool registry is missing ${tool}`);
}

for (const table of [
  "jarvis_messages", "jarvis_conversations", "jarvis_tool_calls", "jarvis_memory",
  "jarvis_approvals", "jarvis_activity_log", "jarvis_integrations", "jarvis_alerts",
]) {
  if (!migration.includes(`public.${table}`)) errors.push(`migration is missing ${table}`);
}

for (const content of [assistantRoute, approvalRoute]) {
  if (!content.includes("requireJarvisAdmin")) errors.push("assistant API route is missing admin authorization");
}

if (!approvalRoute.includes('status === "approved"') || !approvalRoute.includes('status === "denied"')) {
  errors.push("approval API does not enforce approve or deny decisions");
}

if (!integrations.includes("credentialEnvironmentKeys") || !integrations.includes("credentialsReady")) {
  errors.push("credential discovery framework is incomplete");
}

for (const required of [
  "https://api.openai.com/v1/responses",
  "process.env.OPENAI_API_KEY",
  "process.env.OPENAI_MODEL",
  "Never claim an external action was completed",
]) {
  if (!openai.includes(required)) errors.push(`OpenAI reasoning handler is missing ${required}`);
}

if (!assistantRoute.includes("askOpenAI") || !assistantRoute.includes("openAIConfigured")) {
  errors.push("assistant route is not connected to the OpenAI reasoning handler");
}

const obviousSecret = /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/;
for (const [label, content] of [["tools", tools], ["integrations", integrations], ["openai", openai], ["migration", migration]]) {
  if (obviousSecret.test(content)) errors.push(`${label} contains an obvious secret`);
}

if (errors.length) {
  console.error("Jarvis Assistant foundation validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Jarvis Assistant Phase 1 foundation validation passed.");
