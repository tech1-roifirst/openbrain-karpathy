#!/usr/bin/env node

/**
 * Build script for Karpathy tasks
 * Handles building individual task outputs that have their own build processes
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '..', 'output');

console.log('🔨 Building Karpathy task outputs...\n');

let allPassed = true;

// Check which task outputs have package.json (require their own build)
const tasks = fs.readdirSync(outputDir).filter(d => d.startsWith('task-'));

for (const taskDir of tasks) {
  const taskPath = path.join(outputDir, taskDir);
  const packageJsonPath = path.join(taskPath, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    console.log(`📦 Building ${taskDir}...`);
    try {
      execSync('npm run build', {
        cwd: taskPath,
        stdio: 'pipe'
      });
      console.log(`✅ ${taskDir} built successfully\n`);
    } catch (e) {
      console.error(`❌ ${taskDir} build failed: ${e.message}\n`);
      allPassed = false;
    }
  } else {
    // Tasks without package.json (SQL, schema files, etc.) are considered "built"
    console.log(`⚪ ${taskDir} (no build needed)\n`);
  }
}

if (!allPassed) {
  console.error('❌ Build failed for some tasks');
  process.exit(1);
}

console.log('✅ All builds complete');
process.exit(0);
