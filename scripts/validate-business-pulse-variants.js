#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const files = [
  path.join(root, 'chick-fil-a-system/n8n/monitored/Brenham-with-jarvis-pulses.json'),
  path.join(root, 'idad-system/n8n/monitored/IDAD-Automations-with-jarvis-pulses.json'),
];
const required = [
  'Jarvis Pulse - Receipt Received',
  'Jarvis Pulse - Receipt Completed',
  'Jarvis Pulse - Receipt Manual Review',
  'Jarvis Pulse - Checklist Completed',
  'Jarvis Pulse - Texas Hourlys',
  'Jarvis Pulse - Taco Johns Metrics',
  'Jarvis Pulse - Product Mix Delivered',
];

let failures = 0;
for (const filename of files) {
  const workflow = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const names = workflow.nodes.map((node) => node.name);
  const ids = workflow.nodes.map((node) => node.id);
  const pulses = workflow.nodes.filter((node) => node.name.startsWith('Jarvis Pulse - '));

  if (workflow.active !== false) {
    console.error(`FAIL ${filename}: monitored variant must remain inactive`);
    failures += 1;
  }
  if (new Set(names).size !== names.length || new Set(ids).size !== ids.length) {
    console.error(`FAIL ${filename}: duplicate node name or ID`);
    failures += 1;
  }
  for (const pulse of pulses) {
    if (pulse.onError !== 'continueRegularOutput') {
      console.error(`FAIL ${filename}: ${pulse.name} must continue on fail`);
      failures += 1;
    }
    if (!String(pulse.parameters?.url).endsWith('/webhook/jarvis-automation-pulse')) {
      console.error(`FAIL ${filename}: ${pulse.name} uses the wrong webhook`);
      failures += 1;
    }
  }
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    if (!names.includes(source)) failures += 1;
    for (const groups of Object.values(outputs)) {
      for (const group of groups) {
        for (const connection of group) {
          if (!names.includes(connection.node)) failures += 1;
        }
      }
    }
  }
}

for (const name of required) {
  if (!files.some((filename) => JSON.parse(fs.readFileSync(filename, 'utf8')).nodes.some((node) => node.name === name))) {
    console.error(`FAIL missing required pulse: ${name}`);
    failures += 1;
  }
}

if (failures) process.exit(1);
console.log('Jarvis business pulse variants validation passed.');
