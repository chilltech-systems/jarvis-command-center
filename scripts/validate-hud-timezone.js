const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const errors = [];

const time = read("lib/time.ts");
const dashboard = read("app/page.tsx");
const workflowDetail = read("app/workflows/[id]/page.tsx");

for (const required of [
  'CENTRAL_TIME_ZONE = "America/Chicago"',
  "timeZone: CENTRAL_TIME_ZONE",
  'timeZoneName: "short"',
  "formatCentralSignal",
]) {
  if (!time.includes(required)) errors.push(`Central-time helper is missing ${required}`);
}

for (const [label, content] of [
  ["dashboard", dashboard],
  ["workflow detail", workflowDetail],
]) {
  if (!content.includes('from "@/lib/time"')) errors.push(`${label} does not use the Central-time helper`);
}

if (workflowDetail.includes('e.started_at || "Trigger error without start time"')) {
  errors.push("workflow detail still displays raw execution timestamps");
}

if (errors.length) {
  console.error("Jarvis HUD timezone validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Jarvis HUD Central-time display validation passed.");
