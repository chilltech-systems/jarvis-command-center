-- Optimize Phase 1 assistant RLS evaluation and foreign-key lookups.

create index if not exists jarvis_conversations_owner_idx on public.jarvis_conversations (owner_id);
create index if not exists jarvis_messages_owner_idx on public.jarvis_messages (owner_id);
create index if not exists jarvis_tool_calls_conversation_idx on public.jarvis_tool_calls (conversation_id);
create index if not exists jarvis_tool_calls_message_idx on public.jarvis_tool_calls (message_id);
create index if not exists jarvis_approvals_conversation_idx on public.jarvis_approvals (conversation_id);
create index if not exists jarvis_approvals_tool_call_idx on public.jarvis_approvals (tool_call_id);
create index if not exists jarvis_approvals_decided_by_idx on public.jarvis_approvals (decided_by);
create index if not exists jarvis_activity_conversation_idx on public.jarvis_activity_log (conversation_id);
create index if not exists jarvis_activity_tool_call_idx on public.jarvis_activity_log (tool_call_id);
create index if not exists jarvis_alerts_owner_idx on public.jarvis_alerts (owner_id);

drop policy if exists "Jarvis admins read own conversations" on public.jarvis_conversations;
drop policy if exists "Jarvis admins create own conversations" on public.jarvis_conversations;
drop policy if exists "Jarvis admins update own conversations" on public.jarvis_conversations;
create policy "Jarvis admins read own conversations" on public.jarvis_conversations for select to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins create own conversations" on public.jarvis_conversations for insert to authenticated with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins update own conversations" on public.jarvis_conversations for update to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid())) with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

drop policy if exists "Jarvis admins read own messages" on public.jarvis_messages;
drop policy if exists "Jarvis admins create own messages" on public.jarvis_messages;
create policy "Jarvis admins read own messages" on public.jarvis_messages for select to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins create own messages" on public.jarvis_messages for insert to authenticated with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

drop policy if exists "Jarvis admins read own tool calls" on public.jarvis_tool_calls;
drop policy if exists "Jarvis admins create own tool calls" on public.jarvis_tool_calls;
drop policy if exists "Jarvis admins update own tool calls" on public.jarvis_tool_calls;
create policy "Jarvis admins read own tool calls" on public.jarvis_tool_calls for select to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins create own tool calls" on public.jarvis_tool_calls for insert to authenticated with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins update own tool calls" on public.jarvis_tool_calls for update to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid())) with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

drop policy if exists "Jarvis admins read own memory" on public.jarvis_memory;
drop policy if exists "Jarvis admins create own memory" on public.jarvis_memory;
drop policy if exists "Jarvis admins update own memory" on public.jarvis_memory;
create policy "Jarvis admins read own memory" on public.jarvis_memory for select to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins create own memory" on public.jarvis_memory for insert to authenticated with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins update own memory" on public.jarvis_memory for update to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid())) with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

drop policy if exists "Jarvis admins read own approvals" on public.jarvis_approvals;
drop policy if exists "Jarvis admins create own approvals" on public.jarvis_approvals;
drop policy if exists "Jarvis admins update own approvals" on public.jarvis_approvals;
create policy "Jarvis admins read own approvals" on public.jarvis_approvals for select to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins create own approvals" on public.jarvis_approvals for insert to authenticated with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins update own approvals" on public.jarvis_approvals for update to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid())) with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

drop policy if exists "Jarvis admins read own activity" on public.jarvis_activity_log;
drop policy if exists "Jarvis admins create own activity" on public.jarvis_activity_log;
create policy "Jarvis admins read own activity" on public.jarvis_activity_log for select to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins create own activity" on public.jarvis_activity_log for insert to authenticated with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));

drop policy if exists "Jarvis admins read integrations" on public.jarvis_integrations;
create policy "Jarvis admins read integrations" on public.jarvis_integrations for select to authenticated using ((select public.is_jarvis_admin()));

drop policy if exists "Jarvis admins read own alerts" on public.jarvis_alerts;
drop policy if exists "Jarvis admins create own alerts" on public.jarvis_alerts;
drop policy if exists "Jarvis admins update own alerts" on public.jarvis_alerts;
create policy "Jarvis admins read own alerts" on public.jarvis_alerts for select to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins create own alerts" on public.jarvis_alerts for insert to authenticated with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
create policy "Jarvis admins update own alerts" on public.jarvis_alerts for update to authenticated using ((select public.is_jarvis_admin()) and owner_id = (select auth.uid())) with check ((select public.is_jarvis_admin()) and owner_id = (select auth.uid()));
