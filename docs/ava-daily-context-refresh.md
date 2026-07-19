# Ava Daily Context Refresh

## Operating contract

- Central-day snapshot scope: `ava_core_daily_snapshot`
- Automatic schedule: `0 6 * * *` in `America/Chicago`
- Daily context execution limit: 12 reserved n8n executions
- Expected automatic attempt: 3 executions (scheduler, Tool Hub router, batch executor)
- Automatic attempts: 2 maximum, with the retry delayed 15 minutes
- Manual override: 1 approved action per Central day, under the same 12-execution ceiling
- Page loads, API reads, and Nebula loads only read the stored snapshot

The batch executor reads the Todoist open-task set once, reads completed Todoist activity once, and reads the CHILL TECH and IDAD Gmail accounts inside the same n8n execution. Ava derives Tasks and Calendar from the same open-task result.

## Server-only configuration

The application requires `SUPABASE_SERVICE_ROLE_KEY`, `AVA_CONTEXT_OWNER_ID`, and `AVA_CONTEXT_REFRESH_TOKEN`. The token must never be exposed to browser code.

The scheduled n8n workflow requires variables:

- `AVA_CONTEXT_REFRESH_URL`, set to the production `/api/ava/context/refresh` URL
- `AVA_CONTEXT_REFRESH_TOKEN`, matching the application token

The Tool Hub router keeps its existing `JARVIS_TOKEN` contract and adds this registry entry:

```js
'ava.context.refresh': {
  workflow: 'ava-context-refresh',
  enabled: true,
  webhookPath: '/jarvis-tools/ava-context-refresh',
  permission: 'read',
  required: ['centralDate', 'since', 'until']
}
```

## Activation gate

1. Deploy the app reader, protected endpoint, and Supabase migrations.
2. Import `Ava Daily Context Batch v1` and `Ava Daily Context Refresh - 6 AM Central` inactive.
3. Back up the current Tool Hub router, add the registry entry, and activate only the router and batch executor needed for the test.
4. Send one authenticated production-shaped refresh request.
5. Verify `jarvis_memory`, the usage ledger, the attempt ledger, source statuses, and the n8n execution chain.
6. Repeatedly load Dashboard, Daily Brief, Intelligence Feed, Tasks, Calendar, context API, and Nebula; verify the context-related n8n count does not change.
7. Activate the 6:00 a.m. scheduler only after all checks pass. Leave legacy Gmail and Todoist executors inactive.

If the production-shaped refresh fails, leave the scheduler inactive, restore the router backup, and keep serving the most recent successful snapshot.
