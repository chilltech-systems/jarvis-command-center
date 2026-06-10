# Jarvis Command Center Agent Instructions

## Purpose

Operate a reliable command center for automation events and deliver a useful
morning Slack standup briefing.

## Working Rules

- Keep workflows in `n8n/workflows/`, operational scripts in `scripts/`, and guidance in `docs/`.
- Preserve live webhook paths and trigger contracts when updating workflows or senders.
- Keep reusable workflow exports inactive until production configuration is reviewed.
- The morning standup should exclude `general`, prioritize direct mentions, and still be shown in Codex when external delivery fails.
- Never print or commit the shared n8n API key from `/Users/c.hill/Documents/Projects/.secrets/n8n.env`.
- Validate workflow JSON with `node scripts/validate-n8n-workflow-json.js` after changes.
- Verify a production-shaped request before changing active automation configuration.
