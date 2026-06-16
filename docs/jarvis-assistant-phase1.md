# Jarvis Assistant Phase 1

## Purpose

Phase 1 adds the expandable assistant foundation without changing the existing
Command Center monitoring contracts or executing external actions.

## Architecture

| Layer | Responsibility |
|---|---|
| Floating orb | Persistent draggable entry point stored in browser local storage |
| Assistant panel | Responsive chat, activity, integration inventory, and approvals |
| `/api/jarvis/assistant` | Authenticated server-side request routing and audit logging |
| Tool registry | Independent capability contracts and permission classifications |
| Integration registry | Safe credential discovery using environment-variable presence only |
| Supabase | RLS-protected conversations, messages, tool calls, memory, approvals, activity, integrations, and alerts |

Secrets and external API calls must remain server-side. The browser receives
only capability metadata and whether required credentials are ready.

## Permission Model

| Permission | Phase 1 behavior |
|---|---|
| `read_only` | May run through an authenticated backend handler |
| `draft` | May prepare content but cannot send it |
| `requires_approval` | Creates an approval request showing action, target, and expected result |
| `execute` | Reserved for explicitly approved server-side handlers |

Approving a request executes only reviewed handlers. Current approved execution
handlers include Todoist task creation and Codex prompt queueing for the local
runner.

## Current Capability

`get_n8n_status` is the first live assistant tool. It summarizes current
Command Center metrics from the existing protected Supabase view.

Other initial tools have contracts, statuses, and permission gates ready for
future integration.

Codex prompt queueing uses `jarvis_codex_runs` and the local
`scripts/jarvis-codex-runner.js` process. Vercel queues approved work; the local
Mac runner executes it with local workspace access.

OpenAI reasoning uses the server-side Responses API only when no deterministic
Jarvis tool matches the request. OpenAI never bypasses Jarvis authentication,
tool permissions, approval gates, or execution handlers. Configure
`OPENAI_API_KEY` and optional `OPENAI_MODEL` only in server-side environments.

## Memory Framework

`jarvis_memory` stores structured, source-attributed records by owner, scope,
and key. Phase 1 does not automatically write long-term memory. Future memory
ingestion should be explicit, auditable, and scoped to approved sources.

## Safety Rules

- Never expose service-role, API, OAuth, or bot secrets to the browser.
- Every assistant API request requires an authenticated allowlisted Jarvis admin.
- Every external send, deletion, sensitive workflow run, or production-data
  change requires approval.
- Record tool activity and approval decisions.
- Do not give the frontend direct delete permissions.
