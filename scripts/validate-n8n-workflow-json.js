#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const workflowPath = path.resolve(__dirname, '../n8n/workflows/jarvis-command-center.json');
const requiredFields = [
  'schema_version', 'id', 'timestamp', 'source_workflow', 'workflow_id',
  'execution_id', 'event_type', 'status', 'severity', 'failed_node',
  'error_message', 'ai_diagnosis', 'diagnosis_category', 'suggested_fix',
  'business_area', 'records_processed', 'summary', 'important_outputs_json',
  'safe_context_json', 'execution_url', 'codex_review_recommended',
  'resolved_status', 'expected_frequency', 'last_seen_at',
  'minutes_since_last_seen', 'missed_trigger_risk', 'recommended_action'
];
const requiredNodes = [
  'Jarvis Error Trigger',
  'Jarvis Automation Pulse Webhook',
  'Every 15 Minutes Health Check',
  'Daily Pulse Summary at 6 PM',
  'AI Error Diagnosis',
  'Send Jarvis Slack Alert',
  'Append to Jarvis Event Log'
];
const obviousSecretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /Bearer\s+[A-Za-z0-9._-]{20,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

const errors = [];
let workflow;
let raw;

try {
  raw = fs.readFileSync(workflowPath, 'utf8');
  workflow = JSON.parse(raw);
} catch (error) {
  console.error(`FAIL: Unable to parse ${workflowPath}: ${error.message}`);
  process.exit(1);
}

for (const key of ['name', 'nodes', 'connections', 'active', 'settings']) {
  if (!(key in workflow)) errors.push(`Missing required workflow key: ${key}`);
}
if (workflow.active !== false) errors.push('Workflow must import inactive.');
if (workflow.settings?.timezone !== 'America/Chicago') errors.push('Workflow timezone must be America/Chicago.');

const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
const names = nodes.map(node => node.name);
const ids = nodes.map(node => node.id);
for (const required of requiredNodes) {
  if (!names.includes(required)) errors.push(`Missing required node: ${required}`);
}
for (const [label, values] of [['node name', names], ['node id', ids]]) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length) errors.push(`Duplicate ${label}(s): ${[...new Set(duplicates)].join(', ')}`);
}

for (const [source, groups] of Object.entries(workflow.connections || {})) {
  if (!names.includes(source)) errors.push(`Connection source does not exist: ${source}`);
  for (const outputs of Object.values(groups || {})) {
    for (const output of outputs || []) {
      for (const connection of output || []) {
        if (!names.includes(connection.node)) errors.push(`Connection target does not exist: ${connection.node}`);
      }
    }
  }
}

const pulseWebhook = nodes.find(node => node.name === 'Jarvis Automation Pulse Webhook');
if (pulseWebhook?.parameters?.path !== 'jarvis-automation-pulse') {
  errors.push('Pulse webhook path must be jarvis-automation-pulse.');
}
if (pulseWebhook?.parameters?.httpMethod !== 'POST') errors.push('Pulse webhook must use POST.');

const healthSchedule = nodes.find(node => node.name === 'Every 15 Minutes Health Check');
const healthCron = healthSchedule?.parameters?.rule?.interval?.[0]?.expression;
if (healthCron !== '*/15 * * * *') errors.push('Health check schedule must run every 15 minutes.');
const dailySchedule = nodes.find(node => node.name === 'Daily Pulse Summary at 6 PM');
const dailyCron = dailySchedule?.parameters?.rule?.interval?.[0]?.expression;
if (dailyCron !== '0 18 * * *') errors.push('Daily summary schedule must run at 18:00.');

const codeText = nodes
  .filter(node => node.type === 'n8n-nodes-base.code')
  .map(node => node.parameters?.jsCode || '')
  .join('\n');
for (const field of requiredFields) {
  if (!codeText.includes(field)) errors.push(`Normalized schema field is not present in Code nodes: ${field}`);
}

for (const node of nodes) {
  for (const credential of Object.values(node.credentials || {})) {
    const approvedCredentialIds = new Set(['aTjOXJWLUkr2WiT4']);
    if (!String(credential.id || '').startsWith('PLACEHOLDER_') && !approvedCredentialIds.has(credential.id)) {
      errors.push(`Non-placeholder credential id found in node: ${node.name}`);
    }
  }
}
for (const pattern of obviousSecretPatterns) {
  if (pattern.test(raw)) errors.push(`Possible embedded secret matched pattern: ${pattern}`);
}

const connectorNames = ['AI Error Diagnosis', 'Jarvis OpenAI Model', 'Send Jarvis Slack Alert', 'Append to Jarvis Event Log', 'Read Event Log for Health', 'Read Event Log for Daily Summary'];
for (const name of connectorNames) {
  const node = nodes.find(candidate => candidate.name === name);
  if (name !== 'Jarvis OpenAI Model' && node?.onError !== 'continueRegularOutput') {
    errors.push(`Connector node must continue safely on error: ${name}`);
  }
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} validation error(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`PASS: ${workflow.name}`);
console.log(`- ${nodes.length} nodes`);
console.log(`- ${Object.keys(workflow.connections || {}).length} connection sources`);
console.log('- Required triggers, schema fields, placeholders, and safety checks verified');
