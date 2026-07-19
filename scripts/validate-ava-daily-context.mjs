#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatCentralDateKey, getCentralDayWindow } from "../lib/ava/time.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const springWindow = getCentralDayWindow(new Date("2026-03-08T18:00:00Z"));
assert.equal((Date.parse(springWindow.until) - Date.parse(springWindow.since)) / 3_600_000, 23, "spring-forward Central day must be 23 hours");
const fallWindow = getCentralDayWindow(new Date("2026-11-01T18:00:00Z"));
assert.equal((Date.parse(fallWindow.until) - Date.parse(fallWindow.since)) / 3_600_000, 25, "fall-back Central day must be 25 hours");
assert.equal(formatCentralDateKey(new Date("2026-07-19T04:59:59Z")), "2026-07-18", "Central date must not roll over before midnight");
assert.equal(formatCentralDateKey(new Date("2026-07-19T05:00:00Z")), "2026-07-19", "Central date must roll over at midnight");

const migration = read("supabase/migrations/20260719051732_ava_daily_context_usage_guard.sql");
for (const contract of [
  "primary key (owner_id, central_date)",
  "for update",
  "reserved_executions + p_expected_executions > p_daily_limit",
  "automatic_attempts >= 2",
  "manual_override_used",
  "refresh_in_progress",
  "grant execute on function public.reserve_ava_context_refresh",
]) assert.ok(migration.includes(contract), `usage migration is missing contract: ${contract}`);

const dailyContext = read("lib/ava/daily-context.ts");
assert.equal((dailyContext.match(/callToolHub<AvaContextBatch>/g) || []).length, 1, "refresh must make exactly one batch Tool Hub call");
assert.ok(dailyContext.includes("AVA_CONTEXT_DAILY_LIMIT = 12"), "daily context limit must remain 12");
assert.ok(dailyContext.includes('tool: "ava.context.refresh"'), "batch tool name must remain stable");

const canvas = read("components/ava-mind/AvaMindCanvas.tsx");
assert.ok(!canvas.includes("setInterval"), "Nebula must not poll the server");

const readSurfaces = [
  "app/dashboard/page.tsx",
  "app/intelligence-feed/page.tsx",
  "app/tasks/page.tsx",
  "app/calendar/page.tsx",
  "app/api/ava/daily-brief/route.ts",
  "app/api/ava/intelligence-feed/route.ts",
  "app/api/ava/tasks/route.ts",
  "app/api/ava/calendar/route.ts",
  "app/api/ava/gmail-attention/route.ts",
  "lib/jarvis/dashboard-context.ts",
];
for (const surface of readSurfaces) {
  const source = read(surface);
  assert.ok(source.includes("daily-context"), `${surface} must use the persisted daily context reader`);
  assert.ok(!/getAvaTasks\(|getAvaSchedule\(|getAvaGmailAttention\(|getAvaExecutiveContext\(/.test(source), `${surface} must not gather live context`);
}

const schedule = JSON.parse(read("n8n/workflows/ava-daily-context-schedule.json"));
assert.equal(schedule.active, false);
assert.equal(schedule.settings.timezone, "America/Chicago");
assert.equal(schedule.nodes.find((node) => node.name === "Daily at 6 AM Central").parameters.rule.interval[0].expression, "0 6 * * *");
assert.equal(schedule.nodes.filter((node) => /^Protected Refresh Attempt /.test(node.name)).length, 2, "scheduler must have exactly two attempts");

console.log("PASS: Ava daily context refresh and usage-guard contracts");
console.log("- Central rollover and 23/25-hour DST days verified");
console.log("- Atomic reservation, budget, retry, override, and duplicate-stop SQL contracts verified");
console.log("- Daily read surfaces and Nebula make zero automatic context-gathering calls");
