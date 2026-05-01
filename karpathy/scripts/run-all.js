#!/usr/bin/env node

/**
 * Run and validate all 9 Karpathy tasks.
 * Usage: node karpathy/scripts/run-all.js
 *
 * This script:
 * 1. Prompts user to confirm all tasks are ready
 * 2. Validates each task (1-9) sequentially
 * 3. Aggregates results
 * 4. Generates summary report
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Karpathy Auto-Improvement Test Suite — Run All Tasks');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Confirm user has generated code
  const proceed = await prompt(
    '✔️  Have you generated code for all 9 tasks? (y/n): '
  );

  if (proceed.toLowerCase() !== 'y') {
    console.log('\n⏸️  Please generate code for all tasks, then run again.');
    rl.close();
    process.exit(0);
  }

  console.log('\n🚀 Starting validation run...\n');

  const results = [];
  const startTime = Date.now();

  // Run all 9 tasks
  for (let i = 1; i <= 9; i++) {
    const taskNum = String(i).padStart(2, '0');
    process.stdout.write(`⏳ Task ${i}/9... `);

    try {
      const output = execSync(`node karpathy/scripts/validate.js ${i}`, {
        cwd: path.join(__dirname, '../..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8'
      });
      results.push({ task: i, passed: true });
      process.stdout.write('✅\n');
    } catch (e) {
      results.push({ task: i, passed: false });
      const errorMsg = e.stderr ? e.stderr.split('\n')[0] : (e.stdout ? e.stdout.split('\n')[-1] : e.message);
      process.stdout.write(`❌ (${errorMsg.substring(0, 50)})\n`);
    }
  }

  const totalTime = Date.now() - startTime;
  const passCount = results.filter(r => r.passed).length;
  const passRate = ((passCount / 9) * 100).toFixed(1);

  // Generate summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📊 Pass Rate: ${passCount}/9 (${passRate}%)`);
  console.log(`⏱️  Total Time: ${(totalTime / 1000 / 60).toFixed(2)} minutes\n`);

  console.log('Task Results:');
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    const taskNames = [
      'REST API',
      'DB Query',
      'Auth Flow',
      'Data Processing',
      'Dashboard',
      'Form',
      'Schema',
      'Query Opt',
      'Pipeline'
    ];
    console.log(`  ${status} Task ${r.task}: ${taskNames[r.task - 1]}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════\n');

  if (passRate >= 95) {
    console.log('🎉 Excellent! Ready to record as baseline or compare.');
  } else if (passRate >= 75) {
    console.log('⚠️  Some tasks failed. Review errors and regenerate code.');
  } else {
    console.log('❌ Multiple failures. Check generated code and try again.');
  }

  console.log('\nNext steps:');
  console.log('  • npm run karpathy:baseline   — lock in current results');
  console.log('  • npm run karpathy:compare    — compare vs baseline');

  rl.close();
}

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

main().catch(console.error);
