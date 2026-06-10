# CHILL TECH Automation Command Center

## Purpose

The CHILL TECH Automation Command Center is the central monitoring and automation-awareness workflow for the CHILL TECH n8n ecosystem. It turns failures, warnings, successful activity, heartbeat events, and daily activity into a shared event log and useful Slack alerts.

The importable workflow is located at:

`n8n/workflows/jarvis-command-center.json`

It imports inactive so credentials and destinations can be configured safely before publishing.

## Live Deployment

Deployed workflow:

- Name: `CHILL TECH Automation Command Center`
- n8n workflow ID: `2qj70xgKW3hirAsP`
- Status: Active
- Slack destination: `automation-errors`
- OpenAI credential: Existing `OpenAi account`
- Existing personal-assistant workflow `JARVIS`: Unchanged

The command center currently handles errors for:

- `IDAD Automations`
- Active `IDAD Overflow`
- Inactive `IDAD Overflow` when it is later activated

Current logging state:

- Event log: `CHILL TECH AUTOMATION Event Log`
- Tab: `Events`
- n8n credential: `CHILL TECH DRIVE`
- Event append logging: Enabled and verified
- Daily 6:00 PM summary: Enabled
- 15-minute missed-trigger checks: Disabled until heartbeat integrations are added

## What Jarvis Does

### Central Error Handling

The `Jarvis Error Trigger` receives failed automatic-execution details from workflows that select Jarvis as their Error Workflow.

Jarvis:

1. Normalizes both standard execution failures and trigger-node activation failures.
2. Redacts likely secrets and truncates oversized context.
3. Applies deterministic severity and issue classification.
4. Requests structured AI diagnosis.
5. Retains a deterministic fallback if AI is unavailable.
6. Sends a Jarvis-style Slack alert.
7. Appends the normalized record to the event log.

n8n Error Trigger limitations:

- Error Trigger runs for automatic executions, not manual test executions.
- Execution ID and URL may be unavailable when the trigger itself fails.
- Standard Error Trigger data does not always contain node input/output context.

### Automation Pulse

Existing workflows can POST business-aware activity to:

`/webhook/jarvis-automation-pulse`

Jarvis validates the payload, responds with an acceptance record, stores it, and alerts Slack when the event represents a warning, missed trigger, or manual review.

### Missed Trigger Awareness

Every 15 minutes, Jarvis reads the event log and compares recent activity against its configurable registry.

- Scheduled workflows can be flagged when they exceed expected timing.
- Event-driven workflows are never flagged only because they have been quiet.
- Unknown schedules stay `Needs Review`.
- Accurate detection requires important workflows to send heartbeat or completion events.

### Daily Pulse Summary

At 6:00 PM America/Chicago, Jarvis summarizes the day's event log into:

- System health score
- Active workflows and business areas
- Successes, failures, and warnings
- Records processed
- Manual reviews
- AI corrections
- Missed-trigger alerts

## Initial Workflow Registry

The registry in `Detect Missed Heartbeats` includes:

| System | Monitoring Mode | Initial Expectation |
|---|---|---|
| Brenham | Scheduled and event driven | Daily |
| Catering Receipt Reader | Event driven | No inactivity alert |
| Catering Reminders | Scheduled | Daily |
| IDAD Automations | Scheduled | Multiple times daily |
| IDAD Overflow | Scheduled | Daily |
| IDAD Intelligence | Event driven | No inactivity alert |
| Athena Messaging | Scheduled and event driven | Daily |
| Monthly Sales Reporting | Scheduled | Needs Review |
| PDF Generation and Distribution | Event driven | No inactivity alert |
| Slack Message Automations | Scheduled and event driven | Daily |
| Google Sheets Reporting Automations | Scheduled and event driven | Daily |

Review and refine these expectations after real pulse history is available.

## Setup

1. Import `n8n/workflows/jarvis-command-center.json`.
2. Create a Google Sheet named `Jarvis Event Log` and an `Events` tab.
3. Add the schema headers from `docs/jarvis-event-schema.md`.
4. Confirm the three Google Sheets nodes target the `CHILL TECH AUTOMATION Event Log` Sheet.
5. Confirm all three nodes use the `CHILL TECH DRIVE` credential.
6. Select the Slack credential and channel in `Send Jarvis Slack Alert`.
7. Select the OpenAI credential in `Jarvis OpenAI Model`.
8. Test the pulse webhook.
9. Publish Jarvis.
10. Select Jarvis as the Error Workflow for each monitored workflow.
11. Add pulse nodes to important existing workflows.

`IDAD Automations` and `IDAD Overflow` currently reference a separate error workflow ID that is not included in the repository. After Jarvis is imported, update those workflows in n8n to select Jarvis as their Error Workflow.

## Slack Alert Styles

Jarvis sends:

- System alerts for failed executions and AI diagnosis
- Automation notices for warnings and manual review
- Missed-trigger alerts
- Daily automation pulse summaries

Alerts contain operational details and recommended actions without dumping raw sensitive context.

## Dashboard Preparation

The event log can power a future Jarvis HUD with:

- Current health score
- Recent executions
- Failures and warnings
- AI diagnosis and suggested fixes
- Workflows fired today
- Records processed
- Active business areas
- Most active workflow
- Missing workflows
- Manual reviews and AI corrections
- Recent Slack activity
- Activity by hour
- Mean time to acknowledge and resolve
- Repeat-failure rate by workflow and node

## Codex Repair Workflow

When `codex_review_recommended` is true:

1. Filter open event-log rows with the flag enabled.
2. Provide Codex the workflow export, failed node, error message, diagnosis, safe context, and execution URL.
3. Ask Codex to inspect the local workflow JSON and relevant extracted code.
4. Test any repair in n8n before publishing.
5. Mark `resolved_status` only after verification.

Jarvis diagnoses and recommends. It does not automatically modify production workflows.
