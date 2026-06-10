#!/usr/bin/env node

const fs = require('fs');

const DEFAULT_WEBHOOK_URL = 'https://simplefai.app.n8n.cloud/webhook/morning-standup-delivery';
const REQUEST_TIMEOUT_MS = 30000;

function usage() {
  console.error('Usage: node scripts/send-standup-delivery.js [payload.json]');
}

async function main() {
  const webhookUrl = process.env.MORNING_STANDUP_DELIVERY_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;

  const inputPath = process.argv[2];
  const raw = inputPath ? fs.readFileSync(inputPath, 'utf8') : fs.readFileSync(0, 'utf8');
  const payload = JSON.parse(raw);

  const errors = [];
  if (!payload.standup_summary || typeof payload.standup_summary !== 'string') {
    errors.push('payload.standup_summary must be a non-empty string.');
  }
  if (!Array.isArray(payload.todoist_tasks)) {
    errors.push('payload.todoist_tasks must be an array, even when empty.');
  }
  if (payload.excluded_channels && !payload.excluded_channels.includes('general')) {
    errors.push('payload.excluded_channels must include general.');
  }
  if (errors.length) {
    throw new Error(`Invalid payload: ${errors.join(' ')}`);
  }

  let response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    const cause = error && typeof error === 'object' ? error.cause : null;
    const details = [
      cause?.code ? `code=${cause.code}` : '',
      cause?.errno ? `errno=${cause.errno}` : '',
      cause?.syscall ? `syscall=${cause.syscall}` : '',
      cause?.address ? `address=${cause.address}` : ''
    ].filter(Boolean).join(' ');
    const hint = error?.name === 'TimeoutError'
      ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms.`
      : 'Likely network sandbox restriction or unreachable webhook.';
    throw new Error(`Webhook request to ${webhookUrl} failed. ${hint}${details ? ` ${details}` : ''}`);
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Webhook failed with ${response.status}: ${text}`);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
