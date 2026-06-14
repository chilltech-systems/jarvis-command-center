# Supabase Monitoring Foundation

## Purpose

Supabase becomes the durable, queryable source for the future Vercel Jarvis HUD.
Google Sheets remains an audit and operational backup for command-center events.

## Created Assets

- `supabase/migrations/20260614000100_jarvis_monitoring_foundation.sql`
- `n8n/workflows/jarvis-execution-collector.json`

## Deployment Status

- Supabase project: `Jarvis-Command-Center` (`gkimbjzayddxlbyiwoqb`)
- Applied migration: `jarvis_monitoring_foundation`
- Applied migration: `allow_missing_execution_start`
- Imported n8n workflow: `Jarvis n8n Execution Collector` (`UftF6bshZdF8LwEz`)
- Collector state: active on a five-minute schedule
- Non-secret n8n and Supabase endpoint URLs are configured in the imported workflow
- Secure `Jarvis n8n API` and `Jarvis Supabase REST Auth` credentials are assigned in n8n
- Execution start timestamps are nullable because n8n trigger-error summaries can omit `startedAt`

## Database Model

| Object | Purpose |
|---|---|
| `jarvis_workflows` | Current workflow inventory, monitoring configuration, and last-known health |
| `jarvis_executions` | Idempotent n8n execution summaries collected every five minutes |
| `jarvis_events` | Business-output pulses, errors, warnings, manual reviews, and AI diagnoses |
| `jarvis_collector_state` | Collector cursor and operational status |
| `jarvis_workflow_health` | HUD-ready current workflow status and today/7-day metrics |
| `jarvis_daily_metrics` | Daily execution totals and success/error counts |

All base tables have row-level security enabled and no anonymous access policies.
The n8n collector must use the Supabase service-role key. Never expose that key
to the future browser application.

## Apply the Migration

Use the Supabase SQL editor:

1. Open the `Jarvis-Command-Center` Supabase project.
2. Open SQL Editor.
3. Paste and run `supabase/migrations/20260614000100_jarvis_monitoring_foundation.sql`.
4. Confirm the four tables and two views exist.

Alternatively, link the repository with the Supabase CLI and run:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Configure the Collector

Import `n8n/workflows/jarvis-execution-collector.json` and replace:

- `PLACEHOLDER_N8N_API_BASE_URL`
- `PLACEHOLDER_N8N_API_KEY`
- `PLACEHOLDER_N8N_EDITOR_BASE_URL`
- `PLACEHOLDER_SUPABASE_URL`
- `PLACEHOLDER_SUPABASE_SERVICE_ROLE_KEY`

Store keys in n8n credentials or protected environment expressions. Do not leave
real keys directly in exported workflow JSON.

The collector is intentionally inactive. Run it manually first and confirm:

```sql
select count(*) from public.jarvis_workflows;
select count(*) from public.jarvis_executions;
select * from public.jarvis_workflow_health order by name;
```

Then activate the five-minute schedule.

## Next Integration

The command-center pulse webhook should dual-write normalized events to
`jarvis_events` and Google Sheets. After that, add detailed output pulses to:

1. Brenham catering receipt processing
2. IDAD imports and reporting
3. Athena messaging
4. Monthly/PDF reporting

The Vercel HUD should read from the views and tables through authenticated
server-side routes, with Supabase Realtime used for the live event timeline.
