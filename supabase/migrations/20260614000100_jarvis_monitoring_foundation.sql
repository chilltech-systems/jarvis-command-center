-- Jarvis Command Center monitoring foundation.
-- Apply through the Supabase SQL editor or CLI after linking the project.

create extension if not exists pgcrypto;

create table if not exists public.jarvis_workflows (
  workflow_id text primary key,
  name text not null,
  active boolean not null default false,
  business_area text not null default 'unclassified',
  monitoring_mode text not null default 'execution-only'
    check (monitoring_mode in ('execution-only', 'scheduled', 'event-driven', 'scheduled-and-event')),
  expected_frequency text,
  expected_minutes integer check (expected_minutes is null or expected_minutes > 0),
  error_workflow_id text,
  tags jsonb not null default '[]'::jsonb,
  last_execution_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_pulse_at timestamptz,
  current_health text not null default 'unknown'
    check (current_health in ('healthy', 'warning', 'critical', 'unknown', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_executions (
  execution_id text primary key,
  workflow_id text not null references public.jarvis_workflows(workflow_id) on delete cascade,
  status text not null,
  mode text,
  finished boolean,
  started_at timestamptz,
  stopped_at timestamptz,
  duration_ms bigint,
  wait_till timestamptz,
  retry_of text,
  retry_success_id text,
  execution_url text,
  collected_at timestamptz not null default now(),
  raw_summary jsonb not null default '{}'::jsonb
);

create table if not exists public.jarvis_events (
  event_id text primary key,
  schema_version text not null default '1.0',
  occurred_at timestamptz not null,
  source_workflow text not null,
  workflow_id text references public.jarvis_workflows(workflow_id) on delete set null,
  execution_id text references public.jarvis_executions(execution_id) on delete set null,
  event_type text not null,
  status text not null,
  severity text not null,
  business_area text not null default 'unclassified',
  summary text not null,
  records_processed bigint not null default 0,
  important_outputs jsonb not null default '{}'::jsonb,
  safe_context jsonb not null default '{}'::jsonb,
  failed_node text,
  error_message text,
  ai_diagnosis text,
  diagnosis_category text,
  suggested_fix text,
  urgency text,
  execution_url text,
  codex_review_recommended boolean not null default false,
  resolved_status text not null default 'open',
  expected_frequency text,
  last_seen_at timestamptz,
  minutes_since_last_seen integer,
  missed_trigger_risk text,
  recommended_action text,
  created_at timestamptz not null default now()
);

create table if not exists public.jarvis_collector_state (
  collector_name text primary key,
  last_cursor text,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  updated_at timestamptz not null default now()
);

create index if not exists jarvis_executions_workflow_started_idx
  on public.jarvis_executions (workflow_id, started_at desc);
create index if not exists jarvis_executions_status_started_idx
  on public.jarvis_executions (status, started_at desc);
create index if not exists jarvis_events_occurred_idx
  on public.jarvis_events (occurred_at desc);
create index if not exists jarvis_events_workflow_occurred_idx
  on public.jarvis_events (workflow_id, occurred_at desc);
create index if not exists jarvis_events_type_occurred_idx
  on public.jarvis_events (event_type, occurred_at desc);

create or replace function public.jarvis_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jarvis_workflows_set_updated_at on public.jarvis_workflows;
create trigger jarvis_workflows_set_updated_at
before update on public.jarvis_workflows
for each row execute function public.jarvis_set_updated_at();

drop trigger if exists jarvis_collector_state_set_updated_at on public.jarvis_collector_state;
create trigger jarvis_collector_state_set_updated_at
before update on public.jarvis_collector_state
for each row execute function public.jarvis_set_updated_at();

create or replace view public.jarvis_workflow_health as
select
  w.workflow_id,
  w.name,
  w.active,
  w.business_area,
  w.monitoring_mode,
  w.expected_frequency,
  w.expected_minutes,
  w.current_health,
  w.last_execution_at,
  w.last_success_at,
  w.last_error_at,
  w.last_pulse_at,
  extract(epoch from (now() - coalesce(w.last_pulse_at, w.last_execution_at))) / 60 as minutes_since_last_seen,
  count(e.execution_id) filter (where e.started_at >= date_trunc('day', now())) as executions_today,
  count(e.execution_id) filter (where e.started_at >= date_trunc('day', now()) and e.status = 'success') as successes_today,
  count(e.execution_id) filter (where e.started_at >= date_trunc('day', now()) and e.status = 'error') as errors_today,
  coalesce(avg(e.duration_ms) filter (where e.started_at >= now() - interval '7 days'), 0)::bigint as avg_duration_ms_7d
from public.jarvis_workflows w
left join public.jarvis_executions e on e.workflow_id = w.workflow_id
group by w.workflow_id;

create or replace view public.jarvis_daily_metrics as
select
  date_trunc('day', started_at) as metric_day,
  count(*) as executions,
  count(*) filter (where status = 'success') as successes,
  count(*) filter (where status = 'error') as errors,
  count(distinct workflow_id) as active_workflows,
  coalesce(avg(duration_ms), 0)::bigint as avg_duration_ms
from public.jarvis_executions
group by date_trunc('day', started_at);

alter table public.jarvis_workflows enable row level security;
alter table public.jarvis_executions enable row level security;
alter table public.jarvis_events enable row level security;
alter table public.jarvis_collector_state enable row level security;

-- No anonymous policies are created. The collector uses a service-role key.
-- Authenticated HUD read policies should be added when the Vercel app is created.
