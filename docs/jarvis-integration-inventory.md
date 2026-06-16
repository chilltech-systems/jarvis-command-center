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
| Google Gmail | Credential Needed | requires_approval | Read, summarize, draft, and approved send |
| Google Calendar | Credential Needed | requires_approval | Read, conflicts, and draft events |
| Google Drive | Credential Needed | read_only | Project knowledge source |
| Slack | Credential Needed | requires_approval | Read, draft, and approved send |
| Codex | Connected | draft | Structured prompt packages; direct execution needs a local runner or Codex connector |
| Business Data Sources | In Progress | read_only | Current n8n pulses are the first signals |
| Project Knowledge | Ready To Configure | read_only | Memory and knowledge schema ready |
| Twilio | Future | requires_approval | Calls and SMS |
| Stripe | Future | requires_approval | Payments and revenue context |

Update both this inventory and `lib/jarvis/integrations.ts` when integration
status changes.
