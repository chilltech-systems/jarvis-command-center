# Jarvis Event Schema

## Version

Current schema version: `1.0`

All Error Trigger records, pulse events, missed-trigger alerts, and daily summaries normalize into the same event shape.

## Required Google Sheets Headers

Create an `Events` tab with these headers in row 1:

```text
schema_version
id
timestamp
source_workflow
workflow_id
execution_id
event_type
status
severity
failed_node
error_message
error_stack
ai_diagnosis
diagnosis_category
suggested_fix
urgency
business_area
records_processed
summary
important_outputs_json
safe_context_json
execution_url
codex_review_recommended
resolved_status
expected_frequency
last_seen_at
minutes_since_last_seen
missed_trigger_risk
recommended_action
likely_node_or_file
```

`Prepare Event Log Row` strips internal fields such as `slack_message`, `should_alert`, and `pulse_valid`, then Google Sheets append uses automatic input mapping for the normalized fields only.

## Field Definitions

| Field | Type | Purpose |
|---|---|---|
| `schema_version` | string | Contract version, currently `1.0` |
| `id` | string | Unique Jarvis event ID |
| `timestamp` | ISO-8601 string | Event time |
| `source_workflow` | string | Human-readable workflow or system name |
| `workflow_id` | string | n8n workflow ID when available |
| `execution_id` | string | n8n execution ID when available |
| `event_type` | string | Normalized event category |
| `status` | string | `success`, `warning`, `failed`, or `rejected` |
| `severity` | string | `normal`, `warning`, `medium`, `high`, or `critical` |
| `failed_node` | string | Failed node name when applicable |
| `error_message` | string | Error or validation message |
| `error_stack` | string | Stack/details when available |
| `ai_diagnosis` | string | Plain-English AI or fallback diagnosis |
| `diagnosis_category` | string | Standard issue classification |
| `suggested_fix` | string | Recommended repair |
| `urgency` | string | `immediate`, `today`, `review`, or `low` |
| `business_area` | string | Operational area such as `catering` or `idad-reporting` |
| `records_processed` | number | Business records processed by the event |
| `summary` | string | Human-readable activity summary |
| `important_outputs_json` | JSON string | Dashboard-safe output metrics |
| `safe_context_json` | JSON string | Redacted and truncated diagnostic context |
| `execution_url` | string | n8n execution link when available |
| `codex_review_recommended` | boolean | Whether workflow JSON/code review is useful |
| `resolved_status` | string | Initially `open`; update after verified resolution |
| `expected_frequency` | string | Expected cadence or `event-driven` / `Needs Review` |
| `last_seen_at` | ISO-8601 string | Last recorded workflow pulse |
| `minutes_since_last_seen` | number/string | Calculated inactivity |
| `missed_trigger_risk` | string | `none`, `unknown`, `high`, or `critical` |
| `recommended_action` | string | Immediate operational next action |
| `likely_node_or_file` | string | AI-identified likely repair location |

## Supported Pulse Event Types

- `execution_success`
- `execution_warning`
- `data_processed`
- `slack_message_sent`
- `report_generated`
- `ai_correction_made`
- `manual_review_needed`
- `missed_trigger_detected`
- `workflow_health_check`
- `heartbeat`

Jarvis itself also writes:

- `execution_error`
- `daily_pulse_summary`

## Pulse Request Example

```json
{
  "source_workflow": "Catering Receipt Reader",
  "event_type": "execution_success",
  "business_area": "catering",
  "summary": "Processed 4 catering receipts and matched 38 menu items",
  "records_processed": 38,
  "important_outputs": {
    "orders_received": 4,
    "unmatched_items": 2,
    "slack_messages_sent": 3
  },
  "severity": "normal",
  "timestamp": "auto"
}
```

Minimum accepted pulse fields:

- `source_workflow`
- A supported `event_type`

Invalid payloads receive an accepted response of `false` and are logged as a warning for integration troubleshooting.

## AI Diagnosis Categories

- `Code issue`
- `Data/input issue`
- `Credential/API issue`
- `External service issue`
- `Timeout/rate limit`
- `Workflow logic issue`
- `Unknown`

## Data Safety

- Error context is recursively redacted when key names resemble passwords, tokens, API keys, cookies, authorization, secrets, or credentials.
- Context depth, array length, object size, and string length are limited.
- Pulse senders should supply only dashboard-safe `important_outputs` and diagnostic `context`.
- Do not send full customer records, credentials, tokens, or unnecessary personal data.
