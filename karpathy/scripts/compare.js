#!/usr/bin/env node

/**
 * Compare latest experiment results against baseline.
 * Usage: node karpathy/scripts/compare.js
 *
 * This script:
 * 1. Loads baseline.json
 * 2. Loads latest experiment results
 * 3. Generates diff report
 * 4. Shows pass/fail changes and pass rate delta
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baselineFile = path.join(__dirname, '..', 'results', 'baseline.json');
const experimentsDir = path.join(__dirname, '..', 'results', 'experiments');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('           Baseline vs. Current Comparison');
console.log('═══════════════════════════════════════════════════════════\n');

// Load baseline
if (!fs.existsSync(baselineFile)) {
  console.error('❌ Baseline not found. Record baseline first:');
  console.error('   npm run karpathy:baseline');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));

// Load latest experiment results
if (!fs.existsSync(experimentsDir)) {
  console.error('❌ No experiment results. Run tests first:');
  console.error('   npm run karpathy:run-all');
  process.exit(1);
}

const files = fs.readdirSync(experimentsDir).sort().reverse();
const currentResults = {};
const taskFiles = {};

files.forEach(file => {
  const match = file.match(/task-(\d+)/);
  if (match) {
    const taskNum = match[1];
    if (!taskFiles[taskNum]) {
      const data = JSON.parse(
        fs.readFileSync(path.join(experimentsDir, file), 'utf-8')
      );
      taskFiles[taskNum] = data;
    }
  }
});

if (Object.keys(taskFiles).length === 0) {
  console.error('❌ No experiment results found.');
  process.exit(1);
}

// Compare task by task
console.log('Task Results:\n');
console.log('Task | Baseline | Current | Change');
console.log('-----|----------|---------|--------');

const taskNames = [
  'REST API',
  'DB Query',
  'Auth Flow',
  'Data Proc',
  'Dashboard',
  'Form',
  'Schema',
  'Query Opt',
  'Pipeline'
];

let totalBaseline = 0;
let totalCurrent = 0;

for (let i = 1; i <= 9; i++) {
  const taskNum = String(i).padStart(2, '0');
  const baselineTask = baseline.tasks[taskNum];
  const currentTask = taskFiles[taskNum];

  if (!baselineTask || !currentTask) continue;

  totalBaseline += baselineTask.passed ? 1 : 0;
  totalCurrent += currentTask.passed ? 1 : 0;

  const baseSym = baselineTask.passed ? '✅' : '❌';
  const currSym = currentTask.passed ? '✅' : '❌';
  const change = (baselineTask.passed === currentTask.passed) ? '—' : (currentTask.passed ? '📈' : '📉');

  console.log(`  ${i} | ${baseSym}      | ${currSym}      | ${change}`);
}

// Calculate pass rate change
const baselinePassRate = baseline.passRate;
const currentPassRate = ((totalCurrent / 9) * 100).toFixed(1);
const passRateDelta = (currentPassRate - baselinePassRate.percentage).toFixed(1);

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`\nBaseline Pass Rate:  ${baselinePassRate.passCount}/9 (${baselinePassRate.percentage}%)`);
console.log(`Current Pass Rate:   ${totalCurrent}/9 (${currentPassRate}%)`);
console.log(`Change:              ${passRateDelta > 0 ? '📈' : passRateDelta < 0 ? '📉' : '—'} ${passRateDelta > 0 ? '+' : ''}${passRateDelta}%`);

console.log('\n═══════════════════════════════════════════════════════════\n');

// Recommendation
if (passRateDelta > 0) {
  console.log('🎉 Improvement detected!');
  console.log('   → Consider: npm run karpathy:baseline (lock in new baseline)');
} else if (passRateDelta < 0) {
  console.log('⚠️  Regression detected.');
  console.log('   → Revert the agent prompt change and try again.');
} else {
  console.log('➡️  No change in pass rate.');
  console.log('   → Try a different optimization or check code quality metrics.');
}

console.log('\nBaseline Info:');
console.log(`  Recorded: ${baseline.recordedAt}`);
if (baseline.metadata.agentVersions) {
  console.log(`  Agent Versions:`);
  Object.entries(baseline.metadata.agentVersions).forEach(([agent, date]) => {
    console.log(`    - ${agent}: ${date}`);
  });
}

console.log('\n');
