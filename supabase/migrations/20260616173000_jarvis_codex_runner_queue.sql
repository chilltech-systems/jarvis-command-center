-- Jarvis Codex runner queue.
-- Stores approved Codex prompt packages for a local Mac runner to execute.

create table if not exists public.jarvis_codex_runs (
  run_id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.jarvis_conversations(conversation_id) on delete set null,
  tool_call_id uuid references public.jarvis_tool_calls(tool_call_id) on delete set null,
  approval_id uuid references public.jarvis_approvals(approval_id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  objective text not null,
  workspace_path text not null default '/Users/c.hill/Documents/Projects',
  prompt text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  requested_by_email text,
  runner_id text,
  local_prompt_path text,
  local_output_path text,
  result_summary text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists jarvis_codex_runs_status_created_idx on public.jarvis_codex_runs (status, created_at);
create index if not exists jarvis_codex_runs_owner_created_idx on public.jarvis_codex_runs (owner_id, created_at desc);
create index if not exists jarvis_codex_runs_tool_call_idx on public.jarvis_codex_runs (tool_call_id);

alter table public.jarvis_codex_runs enable row level security;

create policy "Jarvis admins read own codex runs" on public.jarvis_codex_runs
  for select to authenticated
  using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

create policy "Jarvis admins create own codex runs" on public.jarvis_codex_runs
  for insert to authenticated
  with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

create policy "Jarvis admins update own codex runs" on public.jarvis_codex_runs
  for update to authenticated
  using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()))
  with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

revoke all on public.jarvis_codex_runs from anon;
grant select, insert, update on public.jarvis_codex_runs to authenticated;

insert into public.jarvis_integrations (
  integration_key, display_name, category, status, permission_level,
  credential_requirements, capabilities, configuration_notes
) values (
  'codex',
  'Codex',
  'Development',
  'Connected',
  'requires_approval',
  '["SUPABASE_SERVICE_ROLE_KEY"]',
  '["Create task briefs","Approved local runner queue","Architecture context"]',
  'Jarvis queues approved Codex prompt packages for a local Mac runner. Service-role key is used only by the local runner.'
)
on conflict (integration_key) do update set
  status = excluded.status,
  permission_level = excluded.permission_level,
  credential_requirements = excluded.credential_requirements,
  capabilities = excluded.capabilities,
  configuration_notes = excluded.configuration_notes,
  updated_at = now();
