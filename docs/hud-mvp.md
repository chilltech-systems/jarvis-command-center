# Jarvis HUD MVP

## Live Components

- Private Next.js HUD with Supabase magic-link authentication
- Admin allowlist: `chilltechsolutions.net@gmail.com`
- Supabase-backed overview, activity stream, workflow health, issues, and workflow details
- Active five-minute n8n execution collector
- Active Command Center dual-write to Google Sheets and Supabase
- Additive continue-on-fail business pulses in live Brenham and IDAD Automations

## Pulse Coverage

| System | Signals |
|---|---|
| Brenham Catering Receipt OCR | Receipt heartbeat, completion, unmatched-item manual review |
| Brenham Checklist Completion | Processed checklist completion |
| IDAD Texas Hourlys | Hourly import completion |
| IDAD Taco John's Metrics | Daily metrics completion |
| IDAD Product Mix - TJ | Report generation and delivery |

Master exports remain unchanged. Inactive monitored variants live in each
system's `n8n/monitored/` folder.

## Authentication

The HUD uses the Supabase publishable key in the browser. All base tables have
RLS enabled, all HUD views use invoker security, and only allowlisted
authenticated emails can read monitoring data. The service-role secret is used
only by encrypted n8n credentials.

## Local Development

```bash
npm install
npm run dev
```

Configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.example`.
