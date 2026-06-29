# Ava Build Notes

## Current Architecture

- Framework: Next.js App Router with React 19 and Tailwind CSS imported through `app/globals.css`.
- Routing: authenticated application pages live under `app/`; Supabase OAuth uses `/login`, `/auth/callback`, and `/unauthorized`.
- Existing automation status: Supabase views named `jarvis_hud_overview`, `jarvis_recent_activity`, `jarvis_open_issues`, and `jarvis_workflow_health` feed the n8n status center.
- Existing assistant: `/api/jarvis/assistant` and `/api/jarvis/approvals` handle the current assistant, approval logging, Todoist Tool Hub calls, and Codex runner queueing.
- Styling: global dark command-center CSS with cyan accents, compact panels, metrics, badges, workflow cards, and a floating assistant.
- Environment: Supabase public browser keys plus server-only OpenAI, n8n, Tool Hub, Google, Slack, GitHub, and Codex runner variables in `.env.example`.
- Deployment: private Vercel-shaped Next app using Supabase auth and allowlist checks.
- Live data path: Ava calls the existing Jarvis Tool Hub router for n8n-backed tools, keeping OAuth secrets inside n8n credentials.

## Reused And Preserved

- The live n8n/Supabase monitoring schema, RLS functions, migrations, and `jarvis_*` database names are preserved.
- Existing workflow exports remain in `n8n/workflows/`, including the command center, execution collector, and morning standup delivery workflows.
- Existing `/api/jarvis/*` routes are preserved for assistant compatibility and approval history.
- Existing workflow detail route `/workflows/[id]` is preserved and now links back to Automations.
- Existing n8n Gmail credentials are reused through a read-only Tool Hub executor; no Gmail secrets are stored in Ava.

## Renamed Or Rebranded

- Visible app branding is now Ava.
- The default page is now the Ava Home dashboard instead of the automation HUD.
- The floating assistant is labeled Ask Ava while keeping its backend compatibility layer.
- README and env comments now describe Ava while documenting retained compatibility names.

## Added

- Main Ava navigation tabs: Home, Daily Brief, Calendar, Tasks, Projects, Automations, Intelligence Feed, and Settings.
- Mock data source at `lib/mock-data/ava.ts`.
- Placeholder API routes under `/api/ava/*` for daily brief, weather, calendar, tasks, projects, automations, and intelligence feed.
- New mock pages for daily brief, calendar, tasks, projects, intelligence feed, and settings.
- Automations page containing the preserved live n8n status center.
- Live Todoist scheduled/completed task helpers for calendar, task previews, and daily completion signals.
- Live dual-account Gmail Attention Feed at `/api/ava/gmail-attention` for CHILL TECH and IDAD, with grouped account buckets and metadata-only email items.
- Intelligence Feed now includes a Gmail attention signal when either mailbox has recent inbox items needing review.

## Risks And Assumptions

- Internal `jarvis_*` names are intentionally retained to avoid breaking Supabase, n8n, and runner contracts.
- Mock data remains for future Google Calendar, market, and deeper project integrations; Todoist, weather, automations, and Gmail attention now have live read paths.
- The Automations tab depends on authenticated Supabase access and existing views being present.
- The Ava placeholder APIs do not expose secrets and should be treated as read-only mock contracts for the next integration phase.
- CHILL TECH Gmail currently returns some recent items with snippets but no sender/subject metadata from the n8n Gmail node; IDAD returns richer sender/subject metadata. The feed handles both shapes without exposing bodies.
