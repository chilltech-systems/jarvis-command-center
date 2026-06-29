# Connectivity Marathon - 2026-06-29

## Completed Locally

- Ava now reads the Tool Hub credential catalog and surfaces connected accounts for Gmail, Google Calendar, Google Sheets, Google Drive, Slack, Twilio, and Todoist without exposing secret values.
- Ava assistant registry now includes contracts for Gmail search/draft/send, Calendar read/create, Google Sheets read/write, Slack send, SMS send, Todoist, n8n status, and Codex task queueing.
- Read-only assistant routing was added for:
  - `gmail.search`
  - `calendar.list`
  - `sheets.read` when a sheet ID and range are provided
- Approval-backed Tool Hub execution was added for:
  - `gmail.send`
  - `calendar.create`
  - `slack.send`
  - `sms.send`
  - `sheets.write`

## Verified Live Tool Hub Probes

These probes were run without printing private message or event contents.

| Tool | Result |
|---|---|
| `todoist.list` | Success, HTTP 200 |
| `gmail.search` | Success, HTTP 200 |
| `calendar.list` | Blocked by inactive/missing production webhook |

## Connected Credentials Found

| Service | Connected Accounts |
|---|---:|
| Todoist | 2 |
| Gmail | 4 |
| Slack | 3 |
| Google Sheets | 5 |
| Google Calendar | 3 |
| Google Drive | 1 |
| Twilio | 1 |

## Remaining Blockers

- Calendar, Slack, SMS, and Sheets credentials are present in the Tool Hub catalog, but their real executor workflows are not active as production webhooks.
- The inactive `Jarvis Tool Executor Stubs` workflow registers those missing webhook paths, but it also duplicates Gmail and Todoist paths that already have real active executors. It should not be activated as-is.
- Google Drive has credentials and a Codex connector snapshot, but no Ava Tool Hub `drive.*` executor contract is currently enabled.
- `workflow.run`, `topline.metrics`, and `missedcall.status` are present in the Tool Hub registry but disabled.

## Next Executor Work

Build real, non-stub executor workflows for the missing services with unique production webhook paths:

- Calendar: `calendar.list`, `calendar.create`, `calendar.update`, `calendar.delete`
- Slack: `slack.send`
- SMS: `sms.send`
- Sheets: `sheets.read`, `sheets.write`
- Drive: add `drive.search` / `drive.read` contracts before wiring Ava project knowledge

Keep all write/send/create actions behind Ava approval records.
