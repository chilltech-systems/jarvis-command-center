# Jarvis Codex Runner

Jarvis cannot directly control the Codex desktop app from Vercel. The bridge is
an approved queue:

1. Jarvis prepares a Codex prompt package.
2. Cody approves it in the HUD.
3. The app inserts a row into `jarvis_codex_runs`.
4. A local Mac runner polls Supabase and runs the prompt locally.

## Setup

Apply the migration:

```sql
-- supabase/migrations/20260616173000_jarvis_codex_runner_queue.sql
```

Add these values to local `.env.local` only:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://gkimbjzayddxlbyiwoqb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
JARVIS_CODEX_COMMAND=codex
JARVIS_CODEX_DRY_RUN=0
JARVIS_CODEX_POLL_MS=15000
```

Never add `SUPABASE_SERVICE_ROLE_KEY` to browser-exposed variables or commit it.

## Run

Run once:

```bash
node scripts/jarvis-codex-runner.js
```

Poll continuously:

```bash
node scripts/jarvis-codex-runner.js --watch
```

Local prompt and output files are written under `.codex-runs/`, which is ignored
by Git.

## Test Prompt

Ask Jarvis:

```text
Create a Codex task to inspect the Jarvis Todoist parser and suggest edge-case tests.
```

Approve the request. The local runner should claim the queued run and write:

- `prompt.md`
- `codex-output.txt`

## Current Boundary

The runner is intentionally local because Codex has access to your workspace and
machine context. Vercel only queues approved work; it does not receive local
workspace files or service-role credentials.
