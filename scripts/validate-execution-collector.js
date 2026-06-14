#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, 'n8n/workflows/jarvis-execution-collector.json');
const migrationPath = path.join(root, 'supabase/migrations/20260614000100_jarvis_monitoring_foundation.sql');

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const migration = fs.readFileSync(migrationPath, 'utf8');
const serialized = JSON.stringify(workflow);
const errors = [];

const requiredNodes = [
  'Every 5 Minutes',
  'Fetch Workflow Inventory',
  'Fetch Recent Executions',
  'Normalize Collector Batch',
  'Upsert Workflow Inventory',
  'Upsert Recent Executions',
];
const placeholders = [
  'PLACEHOLDER_N8N_API_BASE_URL',
  'PLACEHOLDER_N8N_API_KEY',
  'PLACEHOLDER_N8N_EDITOR_BASE_URL',
  'PLACEHOLDER_SUPABASE_URL',
  'PLACEHOLDER_SUPABASE_SERVICE_ROLE_KEY',
];
const requiredDatabaseObjects = [
  'public.jarvis_workflows',
  'public.jarvis_executions',
  'public.jarvis_events',
  'public.jarvis_collector_state',
  'public.jarvis_workflow_health',
  'public.jarvis_daily_metrics',
];

const fail = (message) => errors.push(message);
const nodeNames = new Set(workflow.nodes?.map((node) => node.name) ?? []);

if (workflow.active !== false) fail('Collector workflow must import inactive.');
if (workflow.settings?.timezone !== 'America/Chicago') fail('Collector timezone must be America/Chicago.');
for (const name of requiredNodes) {
  if (!nodeNames.has(name)) fail(`Missing required node: ${name}`);
}
for (const placeholder of placeholders) {
  if (!serialized.includes(placeholder)) fail(`Missing required placeholder: ${placeholder}`);
}
if (!serialized.includes('*/5 * * * *')) fail('Missing five-minute collector schedule.');

const nodeIds = workflow.nodes?.map((node) => node.id) ?? [];
if (new Set(nodeIds).size !== nodeIds.length) fail('Node IDs must be unique.');
if (nodeNames.size !== (workflow.nodes?.length ?? 0)) fail('Node names must be unique.');

for (const [source, outputs] of Object.entries(workflow.connections ?? {})) {
  if (!nodeNames.has(source)) fail(`Connection source does not exist: ${source}`);
  for (const output of outputs.main ?? []) {
    for (const connection of output) {
      if (!nodeNames.has(connection.node)) fail(`Connection target does not exist: ${connection.node}`);
    }
  }
}

const normalizeOutputs = workflow.connections?.['Normalize Collector Batch']?.main?.[0] ?? [];
if (normalizeOutputs.length !== 1 || normalizeOutputs[0]?.node !== 'Upsert Workflow Inventory') {
  fail('Workflow inventory must upsert before execution rows.');
}
const workflowUpsertOutputs = workflow.connections?.['Upsert Workflow Inventory']?.main?.[0] ?? [];
if (workflowUpsertOutputs.length !== 1 || workflowUpsertOutputs[0]?.node !== 'Upsert Recent Executions') {
  fail('Execution upsert must follow workflow inventory upsert.');
}
const workflowUpsertNode = workflow.nodes?.find((node) => node.name === 'Upsert Workflow Inventory');
if (workflowUpsertNode?.alwaysOutputData !== true) {
  fail('Workflow inventory upsert must always output data so execution upserts continue after return=minimal.');
}

for (const node of workflow.nodes ?? []) {
  if (node.type === 'n8n-nodes-base.code') {
    try {
      new Function('$input', '$', node.parameters?.jsCode ?? '');
    } catch (error) {
      fail(`Invalid JavaScript in ${node.name}: ${error.message}`);
    }
  }
}

for (const objectName of requiredDatabaseObjects) {
  if (!migration.includes(objectName)) fail(`Migration missing database object: ${objectName}`);
}
for (const table of ['jarvis_workflows', 'jarvis_executions', 'jarvis_events', 'jarvis_collector_state']) {
  if (!new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(migration)) {
    fail(`Migration must enable RLS on public.${table}`);
  }
}

if (errors.length) {
  console.error('Jarvis execution collector validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Jarvis execution collector validation passed.');
