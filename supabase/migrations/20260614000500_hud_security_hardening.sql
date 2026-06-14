alter function public.jarvis_set_updated_at() set search_path = public;

revoke execute on function public.is_jarvis_admin() from anon;

create policy "No direct allowlist access"
on public.jarvis_admin_allowlist
for all
to public
using (false)
with check (false);

create index if not exists jarvis_events_execution_idx
  on public.jarvis_events (execution_id);
