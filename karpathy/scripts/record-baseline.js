#!/usr/bin/env node

/**
 * Record current test results as baseline.
 * Usage: node karpathy/scripts/record-baseline.js
 *
 * This script:
 * 1. Finds latest experiment results
 * 2. Copies to baseline.json
 * 3. Records metadata (timestamp, agent versions)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const resultsDir = path.join(__dirname, '..', 'results');
const experimentsDir = path.join(resultsDir, 'experiments');
const baselineFile = path.join(resultsDir, 'baseline.json');

console.log('\n📌 Recording Baseline Results\n');

// Check if experiments directory exists
if (!fs.existsSync(experimentsDir)) {
  console.error('❌ No experiments found. Run tests first:');
  console.error('   npm run karpathy:run-all');
  process.exit(1);
}

// Find the latest experiment result
const files = fs.readdirSync(experimentsDir)
  .sort()
  .reverse();

if (files.length === 0) {
  console.error('❌ No experiment results found.');
  process.exit(1);
}

// Aggregate latest results from all tasks
const latestResults = {};
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

// Create baseline record
const baseline = {
  recordedAt: new Date().toISOString(),
  passRate: calculatePassRate(taskFiles),
  tasks: taskFiles,
  metadata: {
    description: 'Baseline for Karpathy auto-improvement optimization loop',
    agentVersions: readAgentVersions()
  }
};

// Write baseline
fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));

console.log(`✅ Baseline recorded: ${baselineFile}\n`);
console.log(`📊 Details:`);
console.log(`   Pass Rate: ${baseline.passRate.passCount}/${baseline.passRate.totalTasks} (${baseline.passRate.percentage}%)`);
console.log(`   Recorded: ${baseline.recordedAt}\n`);

console.log('Next step:');
console.log('  1. Modify agent prompt (.claude/agents/*.md)');
console.log('  2. Re-run tasks: npm run karpathy:run-all');
console.log('  3. Compare results: npm run karpathy:compare\n');

function calculatePassRate(taskFiles) {
  const tasks = Object.values(taskFiles);
  const passCount = tasks.filter(t => t.passed).length;
  return {
    passCount,
    totalTasks: tasks.length,
    percentage: ((passCount / tasks.length) * 100).toFixed(1)
  };
}

function readAgentVersions() {
  const agentsDir = path.join(__dirname, '../../.claude/agents');
  const versions = {};

  if (fs.existsSync(agentsDir)) {
    const agents = ['dan-backend-engineer.md', 'coach-frontend-engineer.md', 'data-engineer.md', 'joey-fullstack-backend.md'];
    agents.forEach(agent => {
      const filePath = path.join(agentsDir, agent);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        versions[agent] = stat.mtime.toISOString();
      }
    });
  }

  return versions;
}
