# Morning Standup Delivery

This adds a delivery layer for the Codex-generated morning standup. Codex still reads Chick-fil-A Brenham Slack, excludes `#general`, and prepares the briefing. n8n receives the structured payload, creates or updates Todoist tasks, and sends the briefing as a DM in the second Slack workspace.

## Files

- `n8n/workflows/morning-standup-delivery.json` - importable n8n workflow.
- `n8n/workflows/morning-standup-delivery.sample.json` - sample webhook payload.
- `scripts/send-standup-delivery.js` - local sender for Codex automation output.

## n8n Setup

1. Import `n8n/workflows/morning-standup-delivery.json`.
2. Create a generic **Header Auth** credential:
   - Header name: `Authorization`
   - Header value: `Bearer YOUR_TODOIST_API_TOKEN`
3. Select that credential in `Get Active Todoist Tasks`, `Update Todoist Task`, and `Create Todoist Task`.
4. Select the Slack credential for your second workspace in `Send Standup DM`.
5. Replace `PLACEHOLDER_SECOND_WORKSPACE_USER_ID` in `Send Standup DM` with your user ID from that workspace.
6. Activate the workflow.
7. Confirm the production webhook URL is:

```text
https://simplefai.app.n8n.cloud/webhook/morning-standup-delivery
```

The sender uses this URL by default. `MORNING_STANDUP_DELIVERY_WEBHOOK_URL` can still override it if the workflow URL changes later.

## Payload Contract

Codex should send JSON with:

- `standup_summary`: Slack-ready summary text optimized for Slack `mrkdwn` readability.
- `todoist_tasks`: actionable Cody-owned tasks only; use `[]` when none exist.
- `excluded_channels`: must include `general`.

Each `todoist_tasks` item should include:

- `title`
- `summary`
- `blocker` if known
- `due_date`; tasks without a fixed date default to the delivery date
- `source.channel_id`
- `source.thread_ts` or `source.message_ts`
- `source.permalink`

The workflow deduplicates Todoist tasks by storing and matching `Source Key: <channel_id>:<thread_ts>` in the task description. If no Slack source exists, it falls back to a normalized title and date key.

The Todoist operations intentionally use HTTP Request nodes against `https://api.todoist.com/api/v1`. The native Todoist node in the affected n8n version calls Todoist's deprecated endpoint and returns HTTP `410`.

## Codex Automation Prompt Addition

Add this to the morning standup automation prompt after the summary generation instructions:

```text
After generating the standup, produce a JSON payload with:
- standup_summary: the full Slack-ready briefing.
- todoist_tasks: actionable Cody-owned tasks only.
- excluded_channels: include "general".

Then send that JSON to n8n by running:
node scripts/send-standup-delivery.js

Pass the JSON through stdin. Prefer compact sections, emoji labels, and Slack-friendly emphasis rather than GitHub-style Markdown headings. If the sender fails, still show the standup summary and clearly report the delivery failure.
```

## Local Test

From `/Users/c.hill/Documents/Projects`:

```bash
node scripts/send-standup-delivery.js n8n/workflows/morning-standup-delivery.sample.json
```

Expected behavior:

- The webhook returns `accepted: true`.
- One Todoist task is created on the first run.
- The same Todoist task is updated on the second run.
- The second Slack workspace receives a DM with the standup summary.
