-- Ava daily context refresh usage guard.
-- Automated refreshes reserve their expected n8n executions atomically before
-- gathering context so concurrent requests cannot exceed the daily budget.

create table if not exists public.ava_context_refresh_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  central_date date not null,
  reserved_executions integer not null default 0 check (reserved_executions between 0 and 12),
  automatic_attempts integer not null default 0 check (automatic_attempts between 0 and 2),
  manual_override_used boolean not null default false,
  refresh_in_progress boolean not null default false,
  last_status text not null default 'idle' check (last_status in ('idle', 'running', 'success', 'partial', 'failed', 'blocked')),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_error text,
  source_failures jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, central_date)
);

create index if not exists ava_context_refresh_usage_date_idx
  on public.ava_context_refresh_usage (central_date desc);

create table if not exists public.ava_context_refresh_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  central_date date not null,
  refresh_kind text not null check (refresh_kind in ('automatic', 'manual')),
  reserved_executions integer not null check (reserved_executions > 0 and reserved_executions <= 12),
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  source_failures jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ava_context_refresh_attempts_owner_date_idx
  on public.ava_context_refresh_attempts (owner_id, central_date, started_at desc);

drop trigger if exists ava_context_refresh_usage_set_updated_at on public.ava_context_refresh_usage;
create trigger ava_context_refresh_usage_set_updated_at
before update on public.ava_context_refresh_usage
for each row execute function public.jarvis_set_updated_at();

alter table public.ava_context_refresh_usage enable row level security;
alter table public.ava_context_refresh_attempts enable row level security;

drop policy if exists "Ava admins read own context usage" on public.ava_context_refresh_usage;
create policy "Ava admins read own context usage"
on public.ava_context_refresh_usage for select
to authenticated
using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

drop policy if exists "Ava admins read own context attempts" on public.ava_context_refresh_attempts;
create policy "Ava admins read own context attempts"
on public.ava_context_refresh_attempts for select
to authenticated
using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

revoke all on public.ava_context_refresh_usage from anon, authenticated;
grant select on public.ava_context_refresh_usage to authenticated;
grant select, insert, update on public.ava_context_refresh_usage to service_role;
revoke all on public.ava_context_refresh_attempts from anon, authenticated;
grant select on public.ava_context_refresh_attempts to authenticated;
grant select, insert, update on public.ava_context_refresh_attempts to service_role;

create or replace function public.reserve_ava_context_refresh(
  p_owner_id uuid,
  p_central_date date,
  p_expected_executions integer,
  p_kind text,
  p_daily_limit integer default 12
)
returns table (
  granted boolean,
  attempt_id uuid,
  reserved_executions integer,
  automatic_attempts integer,
  manual_override_used boolean,
  reason text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  usage_row public.ava_context_refresh_usage%rowtype;
  new_attempt_id uuid;
begin
  if p_expected_executions <= 0 or p_daily_limit < 1 or p_daily_limit > 12 then
    raise exception 'Invalid Ava context refresh budget request.';
  end if;
  if p_kind not in ('automatic', 'manual') then
    raise exception 'Invalid Ava context refresh kind.';
  end if;

  insert into public.ava_context_refresh_usage (owner_id, central_date)
  values (p_owner_id, p_central_date)
  on conflict (owner_id, central_date) do nothing;

  select * into usage_row
  from public.ava_context_refresh_usage
  where owner_id = p_owner_id and central_date = p_central_date
  for update;

  if usage_row.refresh_in_progress then
    return query select false, null::uuid, usage_row.reserved_executions, usage_row.automatic_attempts,
      usage_row.manual_override_used, 'refresh_in_progress'::text;
    return;
  end if;
  if usage_row.reserved_executions + p_expected_executions > p_daily_limit then
    update public.ava_context_refresh_usage
    set last_status = 'blocked', last_error = 'daily_budget_exhausted'
    where owner_id = p_owner_id and central_date = p_central_date;
    return query select false, null::uuid, usage_row.reserved_executions, usage_row.automatic_attempts,
      usage_row.manual_override_used, 'daily_budget_exhausted'::text;
    return;
  end if;
  if p_kind = 'automatic' and usage_row.automatic_attempts >= 2 then
    return query select false, null::uuid, usage_row.reserved_executions, usage_row.automatic_attempts,
      usage_row.manual_override_used, 'automatic_attempt_limit'::text;
    return;
  end if;
  if p_kind = 'manual' and usage_row.manual_override_used then
    return query select false, null::uuid, usage_row.reserved_executions, usage_row.automatic_attempts,
      usage_row.manual_override_used, 'manual_override_already_used'::text;
    return;
  end if;

  update public.ava_context_refresh_usage as usage
  set
    reserved_executions = usage.reserved_executions + p_expected_executions,
    automatic_attempts = usage.automatic_attempts + case when p_kind = 'automatic' then 1 else 0 end,
    manual_override_used = usage.manual_override_used or p_kind = 'manual',
    refresh_in_progress = true,
    last_status = 'running',
    last_started_at = now(),
    last_completed_at = null,
    last_error = null,
    source_failures = '[]'::jsonb
  where usage.owner_id = p_owner_id and usage.central_date = p_central_date
  returning usage.* into usage_row;

  insert into public.ava_context_refresh_attempts (
    owner_id, central_date, refresh_kind, reserved_executions
  ) values (
    p_owner_id, p_central_date, p_kind, p_expected_executions
  ) returning ava_context_refresh_attempts.attempt_id into new_attempt_id;

  return query select true, new_attempt_id, usage_row.reserved_executions, usage_row.automatic_attempts,
    usage_row.manual_override_used, null::text;
end;
$$;

revoke execute on function public.reserve_ava_context_refresh(uuid, date, integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_ava_context_refresh(uuid, date, integer, text, integer)
  to service_role;
