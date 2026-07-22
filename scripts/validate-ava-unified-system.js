const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const required = [
  "lib/ava/gateway/health.ts",
  "lib/ava/gateway/execution-budget.ts",
  "app/api/ava/source-health/route.ts",
];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing unified Ava file: ${relative}`);
}

const health = read("lib/ava/gateway/health.ts");
if (!health.includes("AVA_LIVE_TOOL_HUB_TOOLS")) throw new Error("Hosted capability allowlist is missing.");

const capabilities = read("lib/ava/gateway/capabilities.ts");
for (const marker of ["cacheKey", "cacheHit", "5 * 60_000", "n8nExecutionCategory"]) {
  if (!capabilities.includes(marker)) throw new Error(`Unified capability marker missing: ${marker}`);
}
for (const disabled of ["calendar_list", "calendar_create", "sheets_read", "sheets_write"]) {
  const line = capabilities.split("\n").find((candidate) => candidate.includes(`name: "${disabled}"`));
  if (!line?.includes('status: "planned"')) throw new Error(`${disabled} must remain hidden until its executor is live.`);
}

const context = read("lib/ava/gateway/context.ts");
for (const marker of ["dailySourceHealth", "getAvaExecutionBudget", "capabilityHealth", "executionBudget"]) {
  if (!context.includes(marker)) throw new Error(`Unified context marker missing: ${marker}`);
}

const assistant = read("app/api/jarvis/assistant/route.ts");
for (const marker of ["compileAvaContext", "ensureAvaConversation", "sourceHealth", "executionBudget"]) {
  if (!assistant.includes(marker)) throw new Error(`HUD unification marker missing: ${marker}`);
}

console.log("AVA_UNIFIED_SYSTEM_OK");
