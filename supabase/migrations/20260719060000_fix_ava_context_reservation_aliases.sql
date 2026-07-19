-- Qualify ledger columns because the reservation function's table return
-- fields are also PL/pgSQL variables with the same names.
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
    update public.ava_context_refresh_usage as usage
    set last_status = 'blocked', last_error = 'daily_budget_exhausted'
    where usage.owner_id = p_owner_id and usage.central_date = p_central_date;
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

  insert into public.ava_context_refresh_attempts as attempt (
    owner_id, central_date, refresh_kind, reserved_executions
  ) values (
    p_owner_id, p_central_date, p_kind, p_expected_executions
  ) returning attempt.attempt_id into new_attempt_id;

  return query select true, new_attempt_id, usage_row.reserved_executions, usage_row.automatic_attempts,
    usage_row.manual_override_used, null::text;
end;
$$;

revoke execute on function public.reserve_ava_context_refresh(uuid, date, integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_ava_context_refresh(uuid, date, integer, text, integer)
  to service_role;
