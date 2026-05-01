#!/usr/bin/env node

/**
 * Validate a single Karpathy task.
 * Usage: node scripts/validate.js <task-number>
 *
 * This script:
 * 1. Checks if task output directory exists
 * 2. Runs build (npm run build)
 * 3. Runs relevant tests (Playwright for frontend tasks)
 * 4. Records results in karpathy/results/experiments/
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const taskNumber = process.argv[2];
if (!taskNumber || isNaN(taskNumber) || taskNumber < 1 || taskNumber > 9) {
  console.error('❌ Usage: node karpathy/scripts/validate.js <task-number>');
  console.error('   task-number: 1-9');
  process.exit(1);
}

const padTask = String(taskNumber).padStart(2, '0');
const outputDir = path.join(__dirname, '..', 'output', `task-${padTask}`);
const resultsDir = path.join(__dirname, '..', 'results', 'experiments');

// Ensure results directory exists
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

const taskName = {
  1: 'REST API with Validation',
  2: 'Database Query',
  3: 'Authentication Flow',
  4: 'Data Processing',
  5: 'Dashboard Page',
  6: 'Form Component',
  7: 'Schema Design',
  8: 'Query Optimization',
  9: 'Data Pipeline'
}[taskNumber];

const frontendTasks = [5, 6];
const isFrontendTask = frontendTasks.includes(parseInt(taskNumber));

console.log(`\n🧪 Validating Task ${taskNumber}: ${taskName}`);
console.log(`📁 Output directory: ${outputDir}`);

// Check if output directory exists
if (!fs.existsSync(outputDir)) {
  console.error(`\n❌ Output directory not found: ${outputDir}`);
  console.error('   Have you generated code for this task yet?');
  recordResult(false, 'Output directory not found', 0);
  process.exit(1);
}

const startTime = Date.now();
let passed = false;
let error = null;

try {
  // 1. Run build
  console.log('\n🔨 Running build...');
  try {
    execSync('npm run build', {
      cwd: path.join(__dirname, '../..'),
      stdio: 'pipe'
    });
    console.log('✅ Build passed');
  } catch (e) {
    error = `Build failed: ${e.message}`;
    throw new Error(error);
  }

  // 2. Run Playwright tests for frontend tasks
  if (isFrontendTask) {
    console.log('\n🎭 Running Playwright tests...');
    const specFile = path.join(__dirname, '..', 'tests', `task-0${taskNumber}.spec.ts`);

    if (!fs.existsSync(specFile)) {
      console.warn(`⚠️  Playwright spec not found: ${specFile}`);
      console.warn('   Frontend task will pass if build succeeds');
    } else {
      try {
        execSync(`npx playwright test ${specFile}`, {
          cwd: path.join(__dirname, '../..'),
          stdio: 'pipe'
        });
        console.log('✅ Playwright tests passed');
      } catch (e) {
        error = `Playwright tests failed: ${e.message}`;
        throw new Error(error);
      }
    }
  }

  // 3. Backend tasks: check for generated code files
  if (!isFrontendTask) {
    console.log('\n✔️  Backend task validation');
    const files = fs.readdirSync(outputDir);
    if (files.length === 0) {
      throw new Error('No generated files found in output directory');
    }
    console.log(`✅ Generated files found: ${files.join(', ')}`);
  }

  passed = true;
  console.log('\n✅ Task validation passed!');

} catch (e) {
  passed = false;
  error = error || e.message;
  console.error(`\n❌ Task validation failed: ${error}`);
}

const duration = Date.now() - startTime;
recordResult(passed, error, duration);

process.exit(passed ? 0 : 1);

function recordResult(passed, error, duration) {
  const timestamp = new Date().toISOString();
  const result = {
    task: taskNumber,
    taskName,
    passed,
    error: error || null,
    duration: `${(duration / 1000).toFixed(2)}s`,
    timestamp,
    type: isFrontendTask ? 'frontend' : 'backend'
  };

  const resultFile = path.join(resultsDir, `task-${padTask}-${timestamp.slice(0, 10)}.json`);
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));

  console.log(`\n📊 Result saved: ${resultFile}`);
}
