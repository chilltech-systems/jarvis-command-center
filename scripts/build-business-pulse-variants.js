#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const webhookUrl = 'https://simplefai.app.n8n.cloud/webhook/jarvis-automation-pulse';

function pulseNode(name, id, position, body) {
  return {
    parameters: {
      method: 'POST',
      url: webhookUrl,
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ ${body} }}`,
      options: {},
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    id,
    name,
    onError: 'continueRegularOutput',
  };
}

function connect(workflow, source, target) {
  workflow.connections[source] ??= { main: [[]] };
  workflow.connections[source].main ??= [[]];
  workflow.connections[source].main[0] ??= [];
  workflow.connections[source].main[0].push({ node: target, type: 'main', index: 0 });
}

function addNodes(workflow, nodes) {
  const existing = new Set(workflow.nodes.map((node) => node.name));
  workflow.nodes.push(...nodes.filter((node) => !existing.has(node.name)));
}

function common(source, eventType, businessArea, summary, outputs = {}) {
  return `{ source_workflow: ${JSON.stringify(source)}, workflow_id: $workflow.id, execution_id: $execution.id, event_type: ${JSON.stringify(eventType)}, business_area: ${JSON.stringify(businessArea)}, summary: ${JSON.stringify(summary)}, records_processed: $input.all().length, important_outputs: ${JSON.stringify(outputs)}, timestamp: 'auto' }`;
}

const brenham = JSON.parse(fs.readFileSync('/private/tmp/jarvis-live-backups/brenham-pre-hud.json', 'utf8'));
addNodes(brenham, [
  pulseNode('Jarvis Pulse - Receipt Received', '9d1a6ee4-a78e-45c6-b554-c29a03083001', [-6380, 3050], common('Brenham Catering Receipt OCR', 'heartbeat', 'catering', 'Catering receipt received for processing.')),
  pulseNode('Jarvis Pulse - Receipt Completed', '9d1a6ee4-a78e-45c6-b554-c29a03083002', [-2700, 3320], common('Brenham Catering Receipt OCR', 'data_processed', 'catering', 'Catering receipt OCR and matching completed.', { pipeline: 'receipt-ocr' })),
  pulseNode('Jarvis Pulse - Receipt Manual Review', '9d1a6ee4-a78e-45c6-b554-c29a03083003', [-2700, 3880], common('Brenham Catering Receipt OCR', 'manual_review_needed', 'catering', 'Catering receipt contains unmatched items requiring review.', { review_type: 'unmatched-items' })),
  pulseNode('Jarvis Pulse - Checklist Completed', '9d1a6ee4-a78e-45c6-b554-c29a03083004', [3400, -1500], common('Brenham Checklist Completion', 'data_processed', 'restaurant-operations', 'Checklist completion event processed.', { source: 'checklist-webhook' })),
]);
connect(brenham, 'Webhook4', 'Jarvis Pulse - Receipt Received');
connect(brenham, 'Code in JavaScript69', 'Jarvis Pulse - Receipt Completed');
connect(brenham, 'Append row in sheet4', 'Jarvis Pulse - Receipt Manual Review');
connect(brenham, 'Code in JavaScript25', 'Jarvis Pulse - Checklist Completed');
connect(brenham, 'Code in JavaScript45', 'Jarvis Pulse - Checklist Completed');
brenham.active = false;

const idad = JSON.parse(fs.readFileSync('/private/tmp/jarvis-live-backups/idad-automations-pre-hud.json', 'utf8'));
addNodes(idad, [
  pulseNode('Jarvis Pulse - Texas Hourlys', '50291dd5-8349-478f-8684-cad033083001', [-1950, -240], common('IDAD Texas Hourlys', 'data_processed', 'idad-reporting', 'Texas hourly reporting data imported.', { report: 'texas-hourlys' })),
  pulseNode('Jarvis Pulse - Taco Johns Metrics', '50291dd5-8349-478f-8684-cad033083002', [-1600, 2080], common("IDAD Taco John's Metrics", 'report_generated', 'idad-reporting', "Taco John's daily metrics updated.", { report: 'daily-metrics' })),
  pulseNode('Jarvis Pulse - Product Mix Delivered', '50291dd5-8349-478f-8684-cad033083003', [6600, -3500], common("IDAD Product Mix - TJ", 'report_generated', 'idad-reporting', "Taco John's product mix report updated and delivery notification sent.", { report: 'product-mix', delivered: true })),
]);
connect(idad, 'Google Sheets10', 'Jarvis Pulse - Texas Hourlys');
connect(idad, 'TJ Daily Metrics', 'Jarvis Pulse - Taco Johns Metrics');
connect(idad, 'TJ LY Daily Metrics', 'Jarvis Pulse - Taco Johns Metrics');
connect(idad, 'Send a message', 'Jarvis Pulse - Product Mix Delivered');
idad.active = false;

const outputs = [
  [path.join(root, 'chick-fil-a-system/n8n/monitored/Brenham-with-jarvis-pulses.json'), brenham],
  [path.join(root, 'idad-system/n8n/monitored/IDAD-Automations-with-jarvis-pulses.json'), idad],
  ['/private/tmp/brenham-live-with-pulses.json', brenham],
  ['/private/tmp/idad-live-with-pulses.json', idad],
];

for (const [filename, workflow] of outputs) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(workflow, null, 2)}\n`);
}

console.log('Built Brenham and IDAD monitored workflow variants.');
