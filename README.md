# Ava

Ava is the private personal and business AI operating system dashboard for Cody
Hill and CHILL TECH. It brings daily attention, tasks, calendar context,
projects, intelligence signals, and automation health into one command center.

The original automation infrastructure is preserved. Some internal files,
database tables, API routes, workflow exports, and environment variables still
use `jarvis` names for compatibility with the existing Supabase, n8n, and Codex
runner contracts.

## Key Assets

- `app/` - private Next.js Ava dashboard
- `lib/mock-data/ava.ts` - mock data for non-live Ava tabs
- `app/api/ava/` - placeholder Ava JSON API routes
- `n8n/workflows/jarvis-command-center.json`
- `n8n/workflows/jarvis-execution-collector.json`
- `n8n/workflows/morning-standup-delivery.json`
- `n8n/workflows/morning-standup-delivery.sample.json`
- `supabase/migrations/20260614000100_jarvis_monitoring_foundation.sql`
- `scripts/validate-n8n-workflow-json.js`
- `scripts/validate-execution-collector.js`
- `scripts/validate-business-pulse-variants.js`
- `scripts/validate-hud-auth.js`
- `scripts/validate-jarvis-assistant-foundation.js`
- `scripts/send-standup-delivery.js`
- `lib/jarvis/` - preserved assistant tools, permissions, and integration registry
- `docs/jarvis-assistant-phase1.md`
- `docs/jarvis-integration-inventory.md`

Shared n8n credentials remain outside this repository at
`/Users/c.hill/Documents/Projects/.secrets/n8n.env`.

## Local Development

```bash
npm run dev
```

Open the local Next.js URL and sign in with an approved Google account.
