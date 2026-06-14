-- n8n trigger-error execution summaries can omit startedAt.
alter table public.jarvis_executions
  alter column started_at drop not null;
