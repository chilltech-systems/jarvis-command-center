# Jarvis Integration Inventory

This is the master Phase 1 inventory. Runtime credential discovery checks only
whether named server-side environment variables exist; it never returns
credential values.

| Integration | Status | Permission | Phase 1 Notes |
|---|---|---|---|
| Supabase | Connected | execute | Auth, monitoring data, and assistant audit foundation |
| Vercel | Connected | read_only | Private HUD and server-side routes |
| GitHub | Connected | draft | Repository and deployment connection |
| n8n | Connected | requires_approval | Monitoring connected; approved trigger handler is future work |
| OpenAI | Connected | execute | Server-side Responses API handler active in production |
| Google Gmail | Connected | requires_approval | Tool Hub has 4 connected Gmail accounts; Ava can search/summarize and prepare approved sends |
| Google Calendar | Connected | requires_approval | Tool Hub has 3 connected Calendar accounts; Ava can list events and prepare approved creates |
| Google Drive | Connected | read_only | Codex connector and 1 Tool Hub Drive credential are visible; Ava Drive search handler is still future work |
| Slack | Connected | requires_approval | Tool Hub has 3 connected Slack accounts; Ava can prepare approved sends |
| Codex | Connected | requires_approval | Structured prompt packages queued for the local runner |
| Business Data Sources | Connected | read_only | Tool Hub has 5 connected Google Sheets accounts; metrics-specific tools remain scoped follow-up work |
| Project Knowledge | Ready To Configure | read_only | Memory and knowledge schema ready |
| Twilio | Connected | requires_approval | Tool Hub has 1 connected Twilio account; Ava can prepare approved SMS sends |
| Stripe | Future | requires_approval | Payments and revenue context |

Update both this inventory and `lib/jarvis/integrations.ts` when integration
status changes. Runtime status also considers connected accounts in
`/Users/c.hill/Documents/Projects/jarvis-tool-hub/schemas/credential-routing-catalog.json`.
