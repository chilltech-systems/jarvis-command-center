# Jarvis Command Center

Jarvis Command Center contains the central event-routing workflow and the
morning Slack standup delivery workflow, along with their documentation,
validators, and sender scripts.

## Key Assets

- `n8n/workflows/jarvis-command-center.json`
- `n8n/workflows/morning-standup-delivery.json`
- `n8n/workflows/morning-standup-delivery.sample.json`
- `scripts/validate-n8n-workflow-json.js`
- `scripts/send-standup-delivery.js`

Shared n8n credentials remain outside this repository at
`/Users/c.hill/Documents/Projects/.secrets/n8n.env`.
