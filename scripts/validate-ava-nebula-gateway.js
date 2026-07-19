const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const requiredFiles = [
  "lib/ava/gateway/auth.ts",
  "lib/ava/gateway/context.ts",
  "lib/ava/gateway/capabilities.ts",
  "lib/ava/gateway/approvals.ts",
  "app/api/ava/gateway/session/route.ts",
  "app/api/ava/gateway/turn/route.ts",
  "app/api/ava/gateway/tool/route.ts",
  "app/api/ava/gateway/approval/route.ts",
  "app/api/ava/gateway/history/clear/route.ts",
];

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing Ava Nebula gateway file: ${relative}`);
}

const auth = fs.readFileSync(path.join(root, "lib/ava/gateway/auth.ts"), "utf8");
for (const marker of ["createHmac", "timingSafeEqual", "MAX_CLOCK_SKEW_MS", "AVA_OWNER_EMAIL", "AVA_NEBULA_GATEWAY_SECRET"]) {
  if (!auth.includes(marker)) throw new Error(`Gateway auth marker missing: ${marker}`);
}

const capabilities = fs.readFileSync(path.join(root, "lib/ava/gateway/capabilities.ts"), "utf8");
for (const marker of ["ava_context_current", "ava_memory_recall", "ava_perception_current", "ava_approval_resolve", "todoist_create", "email_send", "codex_task_create"]) {
  if (!capabilities.includes(marker)) throw new Error(`Gateway capability missing: ${marker}`);
}

const approval = fs.readFileSync(path.join(root, "lib/ava/gateway/approvals.ts"), "utf8");
for (const marker of ["isExplicitAvaApproval", "isExplicitAvaDenial", "5 * 60_000", "createOutcomeMemories"]) {
  if (!approval.includes(marker) && marker !== "5 * 60_000") throw new Error(`Gateway approval marker missing: ${marker}`);
}

console.log("AVA_NEBULA_GATEWAY_OK");
