# Jarvis Command Center

Jarvis Command Center contains the private automation operations HUD, central
event-routing workflow, execution collector, and morning Slack standup delivery
workflow.

## Key Assets

- `n8n/workflows/jarvis-command-center.json`
- `n8n/workflows/jarvis-execution-collector.json`
- `n8n/workflows/morning-standup-delivery.json`
- `n8n/workflows/morning-standup-delivery.sample.json`
- `supabase/migrations/20260614000100_jarvis_monitoring_foundation.sql`
- `scripts/validate-n8n-workflow-json.js`
- `scripts/validate-execution-collector.js`
- `scripts/validate-business-pulse-variants.js`
- `scripts/send-standup-delivery.js`
- `app/` - private Next.js Jarvis HUD

Shared n8n credentials remain outside this repository at
`/Users/c.hill/Documents/Projects/.secrets/n8n.env`.
