-- Jarvis Assistant Phase 1 foundation.
-- Stores conversations, tool calls, memory, approvals, activity, integrations,
-- and alerts. External execution remains outside the database and must pass
-- through authenticated server-side handlers.

create table if not exists public.jarvis_conversations (
  conversation_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default 'New Jarvis conversation',
  status text not null default 'active' check (status in ('active', 'archived')),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_messages (
  message_id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.jarvis_conversations(conversation_id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.jarvis_tool_calls (
  tool_call_id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.jarvis_conversations(conversation_id) on delete set null,
  message_id uuid references public.jarvis_messages(message_id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  tool_name text not null,
  permission_level text not null check (permission_level in ('read_only', 'draft', 'requires_approval', 'execute')),
  status text not null default 'planned' check (status in ('planned', 'approval_required', 'approved', 'denied', 'running', 'complete', 'failed')),
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.jarvis_memory (
  memory_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  scope text not null,
  memory_key text not null,
  content jsonb not null,
  source text,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, scope, memory_key)
);

create table if not exists public.jarvis_approvals (
  approval_id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.jarvis_conversations(conversation_id) on delete set null,
  tool_call_id uuid references public.jarvis_tool_calls(tool_call_id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  action text not null,
  target text not null,
  expected_result text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'expired', 'executed', 'failed')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.jarvis_activity_log (
  activity_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  conversation_id uuid references public.jarvis_conversations(conversation_id) on delete set null,
  tool_call_id uuid references public.jarvis_tool_calls(tool_call_id) on delete set null,
  activity_type text not null,
  summary text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.jarvis_integrations (
  integration_key text primary key,
  display_name text not null,
  category text not null,
  status text not null check (status in ('Connected', 'Credential Needed', 'Ready To Configure', 'In Progress', 'Complete', 'Future')),
  permission_level text not null check (permission_level in ('read_only', 'draft', 'requires_approval', 'execute')),
  credential_requirements jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  configuration_notes text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_alerts (
  alert_id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade default auth.uid(),
  source text not null,
  title text not null,
  summary text not null,
  severity text not null default 'normal',
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists jarvis_messages_conversation_created_idx on public.jarvis_messages (conversation_id, created_at);
create index if not exists jarvis_tool_calls_owner_created_idx on public.jarvis_tool_calls (owner_id, created_at desc);
create index if not exists jarvis_approvals_owner_status_idx on public.jarvis_approvals (owner_id, status, created_at desc);
create index if not exists jarvis_activity_owner_created_idx on public.jarvis_activity_log (owner_id, created_at desc);
create index if not exists jarvis_memory_owner_scope_idx on public.jarvis_memory (owner_id, scope);
create index if not exists jarvis_alerts_status_created_idx on public.jarvis_alerts (status, created_at desc);

drop trigger if exists jarvis_conversations_set_updated_at on public.jarvis_conversations;
create trigger jarvis_conversations_set_updated_at before update on public.jarvis_conversations
for each row execute function public.jarvis_set_updated_at();
drop trigger if exists jarvis_memory_set_updated_at on public.jarvis_memory;
create trigger jarvis_memory_set_updated_at before update on public.jarvis_memory
for each row execute function public.jarvis_set_updated_at();
drop trigger if exists jarvis_integrations_set_updated_at on public.jarvis_integrations;
create trigger jarvis_integrations_set_updated_at before update on public.jarvis_integrations
for each row execute function public.jarvis_set_updated_at();

alter table public.jarvis_conversations enable row level security;
alter table public.jarvis_messages enable row level security;
alter table public.jarvis_tool_calls enable row level security;
alter table public.jarvis_memory enable row level security;
alter table public.jarvis_approvals enable row level security;
alter table public.jarvis_activity_log enable row level security;
alter table public.jarvis_integrations enable row level security;
alter table public.jarvis_alerts enable row level security;

create policy "Jarvis admins read own conversations" on public.jarvis_conversations for select to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins create own conversations" on public.jarvis_conversations for insert to authenticated with check (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins update own conversations" on public.jarvis_conversations for update to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid()) with check (public.is_jarvis_admin() and owner_id = auth.uid());

create policy "Jarvis admins read own messages" on public.jarvis_messages for select to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins create own messages" on public.jarvis_messages for insert to authenticated with check (public.is_jarvis_admin() and owner_id = auth.uid());

create policy "Jarvis admins read own tool calls" on public.jarvis_tool_calls for select to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins create own tool calls" on public.jarvis_tool_calls for insert to authenticated with check (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins update own tool calls" on public.jarvis_tool_calls for update to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid()) with check (public.is_jarvis_admin() and owner_id = auth.uid());

create policy "Jarvis admins read own memory" on public.jarvis_memory for select to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins create own memory" on public.jarvis_memory for insert to authenticated with check (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins update own memory" on public.jarvis_memory for update to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid()) with check (public.is_jarvis_admin() and owner_id = auth.uid());

create policy "Jarvis admins read own approvals" on public.jarvis_approvals for select to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins create own approvals" on public.jarvis_approvals for insert to authenticated with check (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins update own approvals" on public.jarvis_approvals for update to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid()) with check (public.is_jarvis_admin() and owner_id = auth.uid());

create policy "Jarvis admins read own activity" on public.jarvis_activity_log for select to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins create own activity" on public.jarvis_activity_log for insert to authenticated with check (public.is_jarvis_admin() and owner_id = auth.uid());

create policy "Jarvis admins read integrations" on public.jarvis_integrations for select to authenticated using (public.is_jarvis_admin());

create policy "Jarvis admins read own alerts" on public.jarvis_alerts for select to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins create own alerts" on public.jarvis_alerts for insert to authenticated with check (public.is_jarvis_admin() and owner_id = auth.uid());
create policy "Jarvis admins update own alerts" on public.jarvis_alerts for update to authenticated using (public.is_jarvis_admin() and owner_id = auth.uid()) with check (public.is_jarvis_admin() and owner_id = auth.uid());

revoke all on public.jarvis_conversations, public.jarvis_messages, public.jarvis_tool_calls,
  public.jarvis_memory, public.jarvis_approvals, public.jarvis_activity_log,
  public.jarvis_integrations, public.jarvis_alerts from anon;
grant select, insert, update on public.jarvis_conversations, public.jarvis_tool_calls,
  public.jarvis_memory, public.jarvis_approvals, public.jarvis_alerts to authenticated;
grant select, insert on public.jarvis_messages, public.jarvis_activity_log to authenticated;
grant select on public.jarvis_integrations to authenticated;

insert into public.jarvis_integrations (
  integration_key, display_name, category, status, permission_level,
  credential_requirements, capabilities, configuration_notes
) values
  ('supabase', 'Supabase', 'Data', 'Connected', 'execute', '["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]', '["Authentication","Monitoring data","Assistant audit storage"]', 'Primary Jarvis data and authentication layer.'),
  ('vercel', 'Vercel', 'Platform', 'Connected', 'read_only', '[]', '["HUD hosting","Server-side API routes"]', 'Hosts the private Jarvis Command Center.'),
  ('github', 'GitHub', 'Development', 'Connected', 'draft', '[]', '["Repository context","Future pull requests"]', 'Connected deployment repository.'),
  ('n8n', 'n8n', 'Automation', 'Connected', 'requires_approval', '[]', '["Workflow status","Execution monitoring","Future approved triggers"]', 'Monitoring data is connected through Supabase.'),
  ('openai', 'OpenAI', 'Intelligence', 'Ready To Configure', 'execute', '["OPENAI_API_KEY"]', '["Assistant reasoning","Tool selection","Summarization"]', 'Add a server-side credential before enabling model responses.'),
  ('gmail', 'Google Gmail', 'Communication', 'Credential Needed', 'requires_approval', '["GOOGLE_GMAIL_CREDENTIAL"]', '["Read email","Summarize inbox","Draft replies","Approved sending"]', 'Requires scoped server-side Google credentials.'),
  ('google_calendar', 'Google Calendar', 'Scheduling', 'Credential Needed', 'requires_approval', '["GOOGLE_CALENDAR_CREDENTIAL"]', '["Read schedule","Detect conflicts","Draft events"]', 'Requires scoped server-side Google credentials.'),
  ('google_drive', 'Google Drive', 'Knowledge', 'Credential Needed', 'read_only', '["GOOGLE_DRIVE_CREDENTIAL"]', '["Search files","Knowledge ingestion"]', 'Assistant access remains separate from n8n credentials.'),
  ('slack', 'Slack', 'Communication', 'Credential Needed', 'requires_approval', '["SLACK_BOT_TOKEN"]', '["Read updates","Draft messages","Approved sending"]', 'Requires a dedicated scoped Jarvis bot credential.'),
  ('codex', 'Codex', 'Development', 'Ready To Configure', 'draft', '[]', '["Create task briefs","Architecture context","Future task handoff"]', 'Phase 1 prepares structured Codex task drafts.'),
  ('business_data', 'Business Data Sources', 'Business Intelligence', 'In Progress', 'read_only', '[]', '["Sales","Labor","Catering","Operations metrics"]', 'Existing Jarvis pulses are the first connected business signals.'),
  ('project_knowledge', 'Project Knowledge', 'Knowledge', 'Ready To Configure', 'read_only', '[]', '["Documentation search","Architecture notes","System explanations"]', 'Memory and knowledge schemas are ready for future ingestion.'),
  ('twilio', 'Twilio', 'Communication', 'Future', 'requires_approval', '[]', '["Calls","SMS"]', 'Future integration.'),
  ('stripe', 'Stripe', 'Finance', 'Future', 'requires_approval', '[]', '["Payments","Revenue context"]', 'Future integration.')
on conflict (integration_key) do update set
  display_name = excluded.display_name,
  category = excluded.category,
  status = excluded.status,
  permission_level = excluded.permission_level,
  credential_requirements = excluded.credential_requirements,
  capabilities = excluded.capabilities,
  configuration_notes = excluded.configuration_notes;
