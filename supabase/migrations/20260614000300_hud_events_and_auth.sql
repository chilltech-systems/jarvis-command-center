create table if not exists public.jarvis_admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.jarvis_admin_allowlist enable row level security;

create or replace function public.is_jarvis_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jarvis_admin_allowlist
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_jarvis_admin() from public;
grant execute on function public.is_jarvis_admin() to authenticated;

create policy "Jarvis admins can read workflows"
on public.jarvis_workflows for select to authenticated
using (public.is_jarvis_admin());

create policy "Jarvis admins can read executions"
on public.jarvis_executions for select to authenticated
using (public.is_jarvis_admin());

create policy "Jarvis admins can read events"
on public.jarvis_events for select to authenticated
using (public.is_jarvis_admin());

create policy "Jarvis admins can read collector state"
on public.jarvis_collector_state for select to authenticated
using (public.is_jarvis_admin());

create or replace function public.ingest_jarvis_event(input_event jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  event_identifier text;
  event_workflow_id text;
  event_execution_id text;
  important_outputs_value jsonb;
  safe_context_value jsonb;
begin
  event_identifier := coalesce(nullif(input_event ->> 'id', ''), gen_random_uuid()::text);
  event_workflow_id := nullif(input_event ->> 'workflow_id', '');
  event_execution_id := nullif(input_event ->> 'execution_id', '');

  if event_workflow_id is not null and not exists (
    select 1 from public.jarvis_workflows where workflow_id = event_workflow_id
  ) then
    event_workflow_id := null;
  end if;

  if event_execution_id is not null and not exists (
    select 1 from public.jarvis_executions where execution_id = event_execution_id
  ) then
    event_execution_id := null;
  end if;

  begin
    important_outputs_value := coalesce(
      input_event -> 'important_outputs',
      nullif(input_event ->> 'important_outputs_json', '')::jsonb,
      '{}'::jsonb
    );
  exception when others then
    important_outputs_value := '{}'::jsonb;
  end;

  begin
    safe_context_value := coalesce(
      input_event -> 'safe_context',
      nullif(input_event ->> 'safe_context_json', '')::jsonb,
      '{}'::jsonb
    );
  exception when others then
    safe_context_value := '{}'::jsonb;
  end;

  insert into public.jarvis_events (
    event_id, schema_version, occurred_at, source_workflow, workflow_id, execution_id,
    event_type, status, severity, business_area, summary, records_processed,
    important_outputs, safe_context, failed_node, error_message, ai_diagnosis,
    diagnosis_category, suggested_fix, urgency, execution_url,
    codex_review_recommended, resolved_status, expected_frequency, last_seen_at,
    minutes_since_last_seen, missed_trigger_risk, recommended_action
  ) values (
    event_identifier,
    coalesce(nullif(input_event ->> 'schema_version', ''), '1.0'),
    coalesce(nullif(input_event ->> 'timestamp', '')::timestamptz, now()),
    coalesce(nullif(input_event ->> 'source_workflow', ''), 'Unknown workflow'),
    event_workflow_id,
    event_execution_id,
    coalesce(nullif(input_event ->> 'event_type', ''), 'workflow_health_check'),
    coalesce(nullif(input_event ->> 'status', ''), 'unknown'),
    coalesce(nullif(input_event ->> 'severity', ''), 'normal'),
    coalesce(nullif(input_event ->> 'business_area', ''), 'unclassified'),
    coalesce(nullif(input_event ->> 'summary', ''), 'Jarvis event received.'),
    coalesce(nullif(input_event ->> 'records_processed', '')::bigint, 0),
    important_outputs_value,
    safe_context_value,
    nullif(input_event ->> 'failed_node', ''),
    nullif(input_event ->> 'error_message', ''),
    nullif(input_event ->> 'ai_diagnosis', ''),
    nullif(input_event ->> 'diagnosis_category', ''),
    nullif(input_event ->> 'suggested_fix', ''),
    nullif(input_event ->> 'urgency', ''),
    nullif(input_event ->> 'execution_url', ''),
    coalesce(nullif(input_event ->> 'codex_review_recommended', '')::boolean, false),
    coalesce(nullif(input_event ->> 'resolved_status', ''), 'open'),
    nullif(input_event ->> 'expected_frequency', ''),
    nullif(input_event ->> 'last_seen_at', '')::timestamptz,
    nullif(input_event ->> 'minutes_since_last_seen', '')::integer,
    nullif(input_event ->> 'missed_trigger_risk', ''),
    nullif(input_event ->> 'recommended_action', '')
  )
  on conflict (event_id) do update set
    occurred_at = excluded.occurred_at,
    status = excluded.status,
    severity = excluded.severity,
    summary = excluded.summary,
    records_processed = excluded.records_processed,
    important_outputs = excluded.important_outputs,
    safe_context = excluded.safe_context,
    resolved_status = excluded.resolved_status,
    recommended_action = excluded.recommended_action;

  if event_workflow_id is not null then
    update public.jarvis_workflows
    set
      last_pulse_at = greatest(
        coalesce(last_pulse_at, '-infinity'::timestamptz),
        coalesce(nullif(input_event ->> 'timestamp', '')::timestamptz, now())
      ),
      business_area = case
        when coalesce(nullif(input_event ->> 'business_area', ''), 'unclassified') = 'unclassified'
          then business_area
        else input_event ->> 'business_area'
      end
    where workflow_id = event_workflow_id;
  end if;

  return event_identifier;
end;
$$;

revoke all on function public.ingest_jarvis_event(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_jarvis_event(jsonb) to service_role;

create or replace view public.jarvis_hud_overview
with (security_invoker = true)
as
select
  count(*) filter (where active) as active_workflows,
  count(*) filter (where active and current_health = 'healthy') as healthy_workflows,
  count(*) filter (where active and current_health = 'warning') as warning_workflows,
  count(*) filter (where active and current_health = 'critical') as critical_workflows,
  count(*) filter (where active and current_health = 'unknown') as unknown_workflows,
  (select count(*) from public.jarvis_executions where started_at >= date_trunc('day', now())) as executions_today,
  (select count(*) from public.jarvis_executions where started_at >= date_trunc('day', now()) and status = 'success') as successes_today,
  (select count(*) from public.jarvis_executions where started_at >= date_trunc('day', now()) and status = 'error') as errors_today,
  (select coalesce(sum(records_processed), 0) from public.jarvis_events where occurred_at >= date_trunc('day', now())) as records_processed_today,
  (select count(*) from public.jarvis_events where resolved_status = 'open' and severity in ('warning', 'high', 'critical')) as open_issues
from public.jarvis_workflows;

create or replace view public.jarvis_recent_activity
with (security_invoker = true)
as
select
  'execution'::text as activity_source,
  e.execution_id as activity_id,
  coalesce(e.started_at, e.stopped_at, e.collected_at) as occurred_at,
  w.name as source_name,
  e.workflow_id,
  e.status,
  case when e.status = 'error' then 'high' else 'normal' end as severity,
  concat('n8n execution ', e.status) as summary,
  e.execution_url,
  '{}'::jsonb as important_outputs
from public.jarvis_executions e
join public.jarvis_workflows w on w.workflow_id = e.workflow_id
union all
select
  'event'::text,
  event_id,
  occurred_at,
  source_workflow,
  workflow_id,
  status,
  severity,
  summary,
  execution_url,
  important_outputs
from public.jarvis_events;

create or replace view public.jarvis_open_issues
with (security_invoker = true)
as
select *
from public.jarvis_events
where resolved_status = 'open'
  and (severity in ('warning', 'medium', 'high', 'critical')
    or event_type in ('execution_error', 'manual_review_needed', 'missed_trigger_detected'));

grant select on public.jarvis_workflow_health, public.jarvis_daily_metrics,
  public.jarvis_hud_overview, public.jarvis_recent_activity, public.jarvis_open_issues
to authenticated;
