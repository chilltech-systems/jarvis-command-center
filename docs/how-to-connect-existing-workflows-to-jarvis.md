# Connect Existing Workflows to Jarvis

## 1. Connect Error Handling

After importing and configuring Jarvis:

1. Open an existing workflow in n8n.
2. Open workflow settings.
3. Select `Jarvis n8n Command Center` as the Error Workflow.
4. Save and publish the existing workflow.

Use this for Brenham, IDAD Automations, IDAD Overflow, IDAD Intelligence, and other important production workflows.

The Error Trigger only runs when an automatic execution fails. A manual editor test will not activate Jarvis.

## 2. Add a Pulse HTTP Request Node

Add an HTTP Request node near the end of a successful or important workflow branch.

Configuration:

- Method: `POST`
- URL: `https://YOUR_N8N_HOST/webhook/jarvis-automation-pulse`
- Send Body: JSON
- Continue On Fail: enabled

Example JSON body:

```json
{
  "source_workflow": "Catering Receipt Reader",
  "workflow_id": "={{ $workflow.id }}",
  "execution_id": "={{ $execution.id }}",
  "event_type": "execution_success",
  "business_area": "catering",
  "summary": "Processed catering receipt workflow successfully",
  "records_processed": "={{ $json.records_processed || 0 }}",
  "important_outputs": {
    "unmatched_items": "={{ $json.unmatched_items?.length || 0 }}",
    "slack_messages_sent": "={{ $json.slack_messages_sent || 0 }}"
  },
  "severity": "normal",
  "timestamp": "auto"
}
```

Keep pulse nodes configured to continue on failure. Jarvis being unavailable must not fail the business workflow.

## 3. Recommended Event Placement

| Workflow Type | Recommended Pulse |
|---|---|
| Scheduled import/report | Send `execution_success` or `report_generated` at completion |
| Long-running workflow | Send `heartbeat` at start and `execution_success` at completion |
| Data pipeline | Send `data_processed` with record count |
| AI correction flow | Send `ai_correction_made` with correction count |
| Human exception flow | Send `manual_review_needed` |
| Slack notification branch | Send `slack_message_sent` after the message succeeds |
| Warning/fallback branch | Send `execution_warning` with recommended action |

## 4. Existing-System Examples

### Catering Receipt Reader

Send:

- `heartbeat` when Webhook4 receives a receipt
- `data_processed` after item matching
- `ai_correction_made` after OCR correction when corrections exist
- `manual_review_needed` when unmatched items remain
- `execution_success` after log and Slack outputs complete

Suggested important outputs:

- Orders received
- Receipt items parsed
- Exact matches
- Alias matches
- AI matches
- Unmatched items
- Slack messages sent

### Brenham Scheduled Operations

Send completion pulses after important scheduled branches such as attendance, drawer shortages, catering reminders, waste checks, prep, and checklist reporting. Use a precise `source_workflow` name for each monitored subsystem if separate heartbeat expectations are needed.

### IDAD Automations and Overflow

Send:

- `heartbeat` at the start of major scheduled reporting runs
- `data_processed` after API/Sheets imports
- `report_generated` after weekly or monthly reports
- `slack_message_sent` or another communication event after delivery
- `execution_warning` when data is incomplete but the workflow continues

### Athena Messaging

Send message counts without including phone numbers or message bodies containing personal data:

```json
{
  "source_workflow": "Athena Messaging",
  "event_type": "data_processed",
  "business_area": "athena-messaging",
  "summary": "Prepared and routed scheduled operational messages",
  "records_processed": 24,
  "important_outputs": {
    "messages_prepared": 24,
    "messages_sent": 23,
    "messages_skipped": 1
  },
  "severity": "warning",
  "recommended_action": "Review the skipped message route."
}
```

### Monthly Sales and PDF Reporting

Use `report_generated` after a report or PDF is ready. Use `manual_review_needed` when an approval, denial, missing PDF, or missing recipient requires attention.

## 5. Heartbeat Design

The initial Jarvis registry is inside the `Detect Missed Heartbeats` Code node.

Each registry entry defines:

- System name
- Business area
- Monitoring mode
- Expected frequency
- Expected minutes between pulses

Do not assign inactivity thresholds to genuinely event-driven workflows. Keep uncertain schedules as `Needs Review` until they are confirmed.

## 6. Testing Checklist

1. POST a valid `execution_success` pulse and confirm response, Sheet row, and no warning alert.
2. POST `manual_review_needed` and confirm the Slack notice.
3. POST an invalid event type and confirm `accepted: false`.
4. Assign Jarvis to an automatic test workflow and intentionally fail it.
5. Confirm secrets in supplied context are redacted.
6. Temporarily disable OpenAI and confirm fallback diagnosis still logs.
7. Temporarily disconnect Slack or Sheets and confirm Jarvis connector nodes continue safely.
8. Send an old heartbeat test row and confirm missed-trigger detection.
9. Run the daily-summary branch and verify metrics.

## 7. Validation

From `/Users/c.hill/Documents/Projects`:

```bash
node --check scripts/validate-n8n-workflow-json.js
node scripts/validate-n8n-workflow-json.js
jq empty n8n/workflows/jarvis-command-center.json
```
