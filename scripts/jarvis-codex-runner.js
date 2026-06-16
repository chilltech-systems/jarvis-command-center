#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const defaultEnvPath = path.join(repoRoot, ".env.local");
const outputRoot = path.join(repoRoot, ".codex-runs");
const runnerId = process.env.JARVIS_CODEX_RUNNER_ID || `${os.hostname()}-${process.pid}`;

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(process.env.JARVIS_CODEX_RUNNER_ENV || defaultEnvPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const codexCommand = process.env.JARVIS_CODEX_COMMAND || "codex";
const dryRun = process.env.JARVIS_CODEX_DRY_RUN === "1";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

function restUrl(pathName, query = "") {
  return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${pathName}${query}`;
}

async function request(pathName, options = {}) {
  const response = await fetch(restUrl(pathName, options.query || ""), {
    method: options.method || "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${pathName} failed with ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function nextQueuedRun() {
  const query = "?select=*&status=eq.queued&order=created_at.asc&limit=1";
  const rows = await request("jarvis_codex_runs", { query });
  return Array.isArray(rows) ? rows[0] : null;
}

async function claimRun(run) {
  const query = `?run_id=eq.${encodeURIComponent(run.run_id)}&status=eq.queued`;
  const rows = await request("jarvis_codex_runs", {
    method: "PATCH",
    query,
    body: {
      status: "running",
      runner_id: runnerId,
      claimed_at: new Date().toISOString(),
    },
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function updateRun(runId, fields) {
  const query = `?run_id=eq.${encodeURIComponent(runId)}`;
  const rows = await request("jarvis_codex_runs", {
    method: "PATCH",
    query,
    body: fields,
  });
  return Array.isArray(rows) ? rows[0] : null;
}

function safeSlug(value) {
  return String(value || "codex-run").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "codex-run";
}

function writePrompt(run) {
  fs.mkdirSync(outputRoot, { recursive: true });
  const dir = path.join(outputRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeSlug(run.title)}`);
  fs.mkdirSync(dir, { recursive: true });
  const promptPath = path.join(dir, "prompt.md");
  const outputPath = path.join(dir, "codex-output.txt");
  fs.writeFileSync(promptPath, run.prompt, "utf8");
  return { dir, promptPath, outputPath };
}

function runCodex(run, promptPath, outputPath) {
  if (dryRun) {
    fs.writeFileSync(outputPath, "Dry run enabled. Codex command was not executed.\n", "utf8");
    return { status: 0, summary: "Dry run wrote prompt file only." };
  }

  const prompt = fs.readFileSync(promptPath, "utf8");
  const workspace = run.workspace_path || repoRoot;
  if (!fs.existsSync(workspace)) throw new Error(`Workspace does not exist: ${workspace}`);
  const result = spawnSync(codexCommand, ["exec", prompt], {
    cwd: workspace,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });
  fs.writeFileSync(outputPath, `${result.stdout || ""}${result.stderr || ""}`, "utf8");
  return {
    status: result.status ?? 1,
    summary: result.status === 0 ? "Codex command completed." : `Codex command exited with status ${result.status ?? "unknown"}.`,
  };
}

async function runOnce() {
  const queued = await nextQueuedRun();
  if (!queued) {
    console.log("No queued Codex runs.");
    return false;
  }

  const claimed = await claimRun(queued);
  if (!claimed) {
    console.log(`Run ${queued.run_id} was already claimed.`);
    return false;
  }

  const paths = writePrompt(claimed);
  await updateRun(claimed.run_id, {
    local_prompt_path: paths.promptPath,
    local_output_path: paths.outputPath,
  });

  try {
    const result = runCodex(claimed, paths.promptPath, paths.outputPath);
    await updateRun(claimed.run_id, {
      status: result.status === 0 ? "succeeded" : "failed",
      result_summary: result.summary,
      error_message: result.status === 0 ? null : result.summary,
      completed_at: new Date().toISOString(),
      local_prompt_path: paths.promptPath,
      local_output_path: paths.outputPath,
    });
    console.log(`${result.summary} Run: ${claimed.run_id}`);
    console.log(`Prompt: ${paths.promptPath}`);
    console.log(`Output: ${paths.outputPath}`);
    return true;
  } catch (error) {
    await updateRun(claimed.run_id, {
      status: "failed",
      error_message: error.message,
      completed_at: new Date().toISOString(),
      local_prompt_path: paths.promptPath,
      local_output_path: paths.outputPath,
    });
    throw error;
  }
}

async function main() {
  const watch = process.argv.includes("--watch");
  do {
    await runOnce();
    if (watch) await new Promise((resolve) => setTimeout(resolve, Number(process.env.JARVIS_CODEX_POLL_MS || 15000)));
  } while (watch);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
