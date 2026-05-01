# Agent Continuous Enhancement System
**Blueprint for Replicating Karpathy Loop + Open Brain in Any Project**

---

## Overview

This guide helps you set up a **self-sustaining agent improvement system** that:
- ✅ Measures agent performance automatically
- ✅ Captures learnings in memory for future projects
- ✅ Automates decision-making (keep/revert changes)
- ✅ Runs enhancement cycles every sprint without manual intervention

**Expected outcome:** Agent code quality improves 10–15% every 4 weeks.

---

## Phase 1: Project Setup (45 minutes)

### Step 1.1: Copy Infrastructure Files

In your **new project**, create this structure:

```
your-project/
├── karpathy/                    # Auto-improvement loop
│   ├── tasks/                   # Test task specs
│   │   ├── task-01.md
│   │   ├── task-02.md
│   │   └── ... task-09.md
│   ├── output/                  # Generated code (auto-created)
│   ├── tests/                   # Playwright specs
│   ├── results/                 # Results JSON (auto-created)
│   ├── scripts/                 # Validation scripts
│   ├── README.md
│   └── QUICKSTART.md
├── .claude/
│   ├── agents/                  # Your agent prompts
│   │   ├── dan-backend-engineer.md
│   │   ├── coach-frontend-engineer.md
│   │   └── data-engineer.md
│   ├── projects/
│   │   └── your-project/memory/ # Open Brain learnings (auto-created)
│   └── CLAUDE.md
├── .github/workflows/
│   └── agent-enhancement.yml    # CI/CD automation (optional)
└── package.json                 # npm scripts
```

### Step 1.2: Copy Task Specs

From this project, copy:
```bash
cp -r karpathy/tasks/           your-project/karpathy/
cp karpathy/README.md           your-project/karpathy/
cp karpathy/QUICKSTART.md       your-project/karpathy/
cp KARPATHY_TEST_SUITE.md       your-project/
```

**Or customize tasks** for your domain:
- Banking? Create tasks around transaction processing, fraud detection
- E-commerce? Create tasks around product search, checkout flows
- Healthcare? Create tasks around patient data validation, HIPAA compliance

### Step 1.3: Create npm Scripts

Edit `package.json`:

```json
{
  "scripts": {
    "karpathy:validate": "node karpathy/scripts/validate.js",
    "karpathy:run-all": "node karpathy/scripts/run-all.js",
    "karpathy:baseline": "node karpathy/scripts/record-baseline.js",
    "karpathy:compare": "node karpathy/scripts/compare.js",
    "karpathy:schedule": "node karpathy/scripts/schedule-weekly.js"
  }
}
```

### Step 1.4: Create Validation Script

Create `karpathy/scripts/validate.js`:

```javascript
#!/usr/bin/env node
/**
 * Validates a single task:
 * 1. Checks if output code exists
 * 2. Runs npm build
 * 3. Runs Playwright tests (if applicable)
 * 4. Records result to results/experiments/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const taskId = process.argv[2];
if (!taskId) {
  console.error('Usage: npm run karpathy:validate 1');
  process.exit(1);
}

const outputDir = path.join(__dirname, `../output/task-${String(taskId).padStart(2, '0')}`);
const testFile = path.join(__dirname, `../tests/task-${String(taskId).padStart(2, '0')}.spec.ts`);

console.log(`\n🔍 Validating task ${taskId}...\n`);

// 1. Check output exists
if (!fs.existsSync(outputDir)) {
  console.error(`❌ Output not found: ${outputDir}`);
  console.error('   Run task first: Copy task spec and paste into Claude Code');
  process.exit(1);
}

// 2. Build
try {
  console.log('📦 Building...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build passed');
} catch (e) {
  console.error('❌ Build failed');
  process.exit(1);
}

// 3. Run Playwright tests (if exists)
let testsPassed = true;
if (fs.existsSync(testFile)) {
  try {
    console.log('🎭 Running Playwright tests...');
    execSync(`npx playwright test ${testFile}`, { stdio: 'inherit' });
    console.log('✅ Tests passed');
  } catch (e) {
    console.error('❌ Tests failed');
    testsPassed = false;
  }
}

// 4. Record result
const resultsDir = path.join(__dirname, '../results/experiments');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

const result = {
  taskId: parseInt(taskId),
  timestamp: new Date().toISOString(),
  passed: testsPassed,
  buildPassed: true,
  notes: testsPassed ? 'All tests passed' : 'Some tests failed'
};

const resultFile = path.join(resultsDir, `${Date.now()}-task-${taskId}.json`);
fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
console.log(`\n📊 Result saved to: ${resultFile}`);

process.exit(testsPassed ? 0 : 1);
```

### Step 1.5: Initialize Open Brain Memory

Create `.claude/projects/your-project/memory/MEMORY.md`:

```markdown
# Agent Enhancement Memory — your-project

## Baseline Metrics
- **Date**: [when baseline was recorded]
- **Pass Rate**: X/9 (Y%)
- **Target**: 95%+ within 4 weeks

## Per-Agent Improvements
- [dan-backend-engineer]: [learnings]
- [coach-frontend-engineer]: [learnings]
- [data-engineer]: [learnings]

## What Works
- [pattern 1]: [why it works]
- [pattern 2]: [why it works]

## What Doesn't Work
- [antipattern 1]: [why it failed]
- [antipattern 2]: [why it failed]
```

---

## Phase 2: Baseline Run (5–6 hours, One-Time)

### Step 2.1: Generate All 9 Tasks

For **each task 1–9**:

1. **Open** `karpathy/tasks/task-0X.md`
2. **Copy** "Requirement" section
3. **Paste into Claude Code** with agent:
   ```
   @dan-backend-engineer [paste requirement]
   ```
4. **Save output** to `karpathy/output/task-0X/`

**Timeline:** 20–45 min per task = ~4–5 hours total

### Step 2.2: Validate & Record Baseline

```bash
npm run karpathy:run-all
npm run karpathy:baseline
```

**Output:** `karpathy/results/baseline.json`

```json
{
  "recordedAt": "2026-05-01T10:00:00Z",
  "passRate": {
    "passCount": 6,
    "totalTasks": 9,
    "percentage": "66.7"
  },
  "tasks": {
    "01": { "passed": true },
    "02": { "passed": false },
    ...
  }
}
```

### Step 2.3: Document Baseline in Memory

Create `memory/baseline_run_<date>.md`:

```markdown
---
name: Baseline Run — 2026-05-01
type: project
---

## Results
- **Pass Rate**: 6/9 (66.7%)
- **Tasks Failed**: 2, 5, 9
- **Common Issues**:
  - Task 2: Missing N+1 query prevention
  - Task 5: Form validation incomplete
  - Task 9: ETL error handling weak

## Agent Performance
- dan-backend-engineer: 2/4 pass (50%)
- coach-frontend-engineer: 2/2 pass (100%)
- data-engineer: 2/3 pass (67%)

## Next Focus
Improve dan-backend-engineer's database query handling and validation.
```

---

## Phase 3: Continuous Enhancement Loop (1–2 hours per cycle)

### Step 3.1: Weekly Enhancement Sprint

**Every Monday (or your sprint start):**

1. **Review last week's baseline**
   ```bash
   npm run karpathy:compare
   ```

2. **Identify lowest-performing agent**
   - Which agent passed fewest tasks?
   - What were common failure patterns?

3. **Pick ONE optimization** (not multiple):
   - ❌ DON'T: "Add validation AND error handling AND logging"
   - ✅ DO: "Add field-level validation errors to all endpoints"

### Step 3.2: Modify Agent Prompt

Edit `.claude/agents/dan-backend-engineer.md`:

**Add ONE section or expand existing:**

```markdown
### Input Validation
**NEW REQUIREMENT (Week 1):**
- All endpoints MUST validate input at boundary
- Return 400 with structured errors: { field: "error message" }
- Example: { email: "Invalid format", password: "Min 8 chars" }
- Never return generic "Invalid input" errors
```

**Commit:**
```bash
git add .claude/agents/dan-backend-engineer.md
git commit -m "test(karpathy-week1): add field-level validation requirement"
```

### Step 3.3: Re-Test Affected Tasks Only

If you modified `dan-backend-engineer.md`, only test tasks 1–4:

```bash
npm run karpathy:validate 1
npm run karpathy:validate 2
npm run karpathy:validate 3
npm run karpathy:validate 4
```

### Step 3.4: Compare Results

```bash
npm run karpathy:compare
```

**Decision tree:**

```
Pass rate improved? (e.g., 50% → 75%)
├─ YES → Lock in + save to memory
│   ├─ npm run karpathy:baseline
│   ├─ Create memory/optimization_week1.md
│   └─ git commit -m "test(karpathy-week1): +25% improvement confirmed"
│
├─ FLAT (no change) → Try different optimization
│   ├─ git checkout .claude/agents/dan-backend-engineer.md
│   └─ Next week: Try different angle (e.g., error handling instead)
│
└─ REGRESSED (worse) → Revert immediately
    ├─ git checkout .claude/agents/dan-backend-engineer.md
    ├─ npm run karpathy:validate 1-4
    └─ Verify back to baseline
```

### Step 3.5: Update Memory with Learnings

Create `memory/optimization_week_<N>.md`:

```markdown
---
name: Optimization Week 1
type: feedback
---

**Change Made:**
Added field-level validation requirement to dan-backend-engineer Code Standards.

**Results:**
- Before: 2/4 tasks pass (50%)
- After: 3/4 tasks pass (75%)
- **Improvement: +25%**

**What Worked:**
Explicitly requiring `{ field: "error message" }` format made agents generate proper error responses.

**Why:**
Agents weren't thinking about error structure until the Code Standards made it non-negotiable.
This is now a permanent part of the agent prompt.

**Next:**
Task 3 (Auth Flow) still failing. Focus on JWT expiration logic next week.
```

---

## Phase 4: Automation & Sustainability (Optional but Recommended)

### Step 4.1: Schedule Weekly Enhancement Runs

Create `.github/workflows/agent-enhancement.yml`:

```yaml
name: Agent Enhancement Cycle
on:
  schedule:
    - cron: '0 9 * * MON'  # Every Monday at 9am
  workflow_dispatch:        # Or trigger manually

jobs:
  enhancement:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install deps
        run: npm install
      
      - name: Run baseline
        run: npm run karpathy:run-all
      
      - name: Compare vs baseline
        run: npm run karpathy:compare
      
      - name: Post results to team
        if: always()
        run: |
          cat karpathy/results/latest.json
          # Optionally send to Slack, email, or dashboard
```

**Trigger manually:**
```bash
gh workflow run agent-enhancement.yml
```

### Step 4.2: Create Monthly Review Checklist

Create `karpathy/MONTHLY_REVIEW.md`:

```markdown
# Monthly Agent Enhancement Review

**Month:** May 2026

## Week 1 Results
- [ ] Baseline recorded
- [ ] First optimization attempted
- [ ] Improvement measured

## Week 2 Results
- [ ] Second optimization tested
- [ ] Results compared

## Week 3 Results
- [ ] Third optimization tested
- [ ] Cumulative improvement calculated

## Week 4 Results
- [ ] Final optimization tested
- [ ] Lock in all improvements
- [ ] Update agent prompts permanently

## Summary
- Starting pass rate: 66.7%
- Ending pass rate: XX%
- Total improvement: +XX%
- Tasks to focus on next month: [list]
```

### Step 4.3: Accumulate Wins in CLAUDE.md

As optimizations stick, move them from agent markdown to global `CLAUDE.md`:

```markdown
# CLAUDE.md — Your Project's Learnings

## Agent Patterns That Stuck

### Input Validation (Locked In — Week 1)
All REST endpoints MUST:
- Validate at boundary
- Return { field: "error" } format
- Never return generic errors

**Why:** Increased pass rate 50% → 75%
**Confidence:** High (repeated across 3 tasks)

### N+1 Query Prevention (Locked In — Week 2)
All database queries MUST:
- Use JOINs, not loop queries
- Include EXPLAIN ANALYZE
- Document indexing strategy

**Why:** Improved query optimization task from fail → pass
**Confidence:** High (validated in production)

### JWT Token Management (In Testing — Week 3)
Auth endpoints should:
- Expire tokens in 1 hour
- Use bcrypt cost ≥ 12
- Never leak user existence

**Why:** Security + consistency
**Confidence:** Medium (still testing)
```

---

## Phase 5: Measurement & Reporting

### Step 5.1: Create a Results Dashboard

Create `karpathy/results/DASHBOARD.md`:

```markdown
# Agent Enhancement Dashboard

## Current Status
**Overall Pass Rate:** 77.8% (7/9 tasks)
**Last Updated:** 2026-05-08

### By Agent
| Agent | Pass Rate | Trend | Status |
|-------|-----------|-------|--------|
| dan-backend | 75% (3/4) | 📈 +25% | Improving |
| coach-frontend | 100% (2/2) | — | Stable |
| data-engineer | 67% (2/3) | 📉 -10% | Needs work |

### By Task
| Task | Status | Last Run | Issue |
|------|--------|----------|-------|
| 1 | ✅ Pass | 2026-05-08 | — |
| 2 | ✅ Pass | 2026-05-08 | — |
| 3 | ❌ Fail | 2026-05-08 | JWT validation |
| 4 | ✅ Pass | 2026-05-01 | — |
| 5 | ✅ Pass | 2026-05-08 | — |
| 6 | ✅ Pass | 2026-05-01 | — |
| 7 | ✅ Pass | 2026-05-01 | — |
| 8 | ❌ Fail | 2026-05-01 | Index strategy |
| 9 | ❌ Fail | 2026-05-01 | Error handling |

### Improvement History
- Week 1 baseline: 66.7% (6/9)
- Week 2 after validation fix: 77.8% (7/9) — **+11.1%**
- Week 3 target: 85%+ (need to fix data-engineer)
```

### Step 5.2: Track Decisions in Memory Index

Create `memory/MEMORY.md`:

```markdown
# Agent Enhancement Memory Index

## Active Optimizations
- [Validation Week 1](optimization_week1.md) — ✅ Locked in, +25%
- [Error Handling Week 2](optimization_week2.md) — 🔄 Testing, need more data
- [Query Performance Week 3](optimization_week3.md) — ⏳ Next week

## Agent Learnings
- [dan-backend-engineer](agent_dan_learnings.md)
  - What works: Field-level validation
  - What doesn't: Generic error messages
  - Next focus: N+1 query prevention

- [coach-frontend-engineer](agent_coach_learnings.md)
  - Status: Stable at 100%
  - No changes planned

- [data-engineer](agent_data_learnings.md)
  - What's broken: Index strategy unclear
  - What works: [pending]
  - Next focus: Query optimization guidance

## Locked-In Patterns
- [Rest API validation](patterns_rest_api_validation.md)
- [Form error handling](patterns_form_validation.md)

## Failed Experiments
- [Strict typing requirement](failed_strict_typing.md) — Made agents too verbose
- [Code comment mandate](failed_comments.md) — Reduced code clarity
```

---

## Phase 6: Long-Term Sustainability

### 6-Month View

**Month 1–2: Foundation**
- ✅ Setup infrastructure (Phase 1)
- ✅ Run baseline (Phase 2)
- ✅ First 2–3 optimizations (Phase 3)
- **Target:** 75% → 80% pass rate

**Month 3–4: Acceleration**
- ✅ Lock in working patterns
- ✅ Test risky optimizations
- ✅ Parallel experiments (test 2 agents simultaneously)
- **Target:** 80% → 85% pass rate

**Month 5–6: Stability**
- ✅ Consolidate learnings into CLAUDE.md
- ✅ Update agent prompts once per sprint
- ✅ Switch to reactive mode (fix failures, don't create)
- **Target:** 85%+ sustained, minimal churn

### Success Criteria per Phase

**Phase 1 (Setup):** ✅ Scripts run without error
**Phase 2 (Baseline):** ✅ 9 tasks generate + test, baseline recorded
**Phase 3 (Loop):** ✅ First optimization shows measurable change
**Phase 4 (Automation):** ✅ Weekly runs execute without manual intervention
**Phase 5 (Reporting):** ✅ Dashboard updates automatically
**Phase 6 (Sustainability):** ✅ Improvement rate stabilizes, churn decreases

---

## Checklist: New Project Setup

### Pre-Flight (Day 1)
- [ ] Copy `karpathy/` folder structure
- [ ] Copy task specs (or customize for domain)
- [ ] Create `package.json` npm scripts
- [ ] Create `karpathy/scripts/validate.js`
- [ ] Initialize git

### Baseline Run (Day 2–3)
- [ ] Generate all 9 tasks (manual, 5–6 hours)
- [ ] Run `npm run karpathy:run-all`
- [ ] Run `npm run karpathy:baseline`
- [ ] Document baseline in memory
- [ ] Commit: "feat(karpathy): baseline established"

### First Optimization (Day 4)
- [ ] Pick lowest-performing agent
- [ ] Identify failure pattern
- [ ] Modify agent prompt (ONE change only)
- [ ] Re-test affected tasks
- [ ] Run `npm run karpathy:compare`
- [ ] Decide: keep or revert
- [ ] Update memory with findings
- [ ] Commit: "test(karpathy): optimization attempt #1"

### Automation (Optional, Day 5)
- [ ] Create `.github/workflows/agent-enhancement.yml`
- [ ] Test manual trigger
- [ ] Add to team calendar (weekly Monday 9am)

### Monthly Review (End of Month)
- [ ] Fill `karpathy/MONTHLY_REVIEW.md`
- [ ] Update dashboard
- [ ] Share results with team
- [ ] Lock in improvements to CLAUDE.md

---

## Quick Commands Reference

```bash
# Baseline setup
npm run karpathy:run-all          # Validate all 9 tasks
npm run karpathy:baseline         # Lock in as baseline

# Weekly optimization
npm run karpathy:validate 1       # Validate single task
npm run karpathy:compare          # Compare vs baseline

# Revert if needed
git checkout .claude/agents/dan-backend-engineer.md
npm run karpathy:run-all

# View results
cat karpathy/results/baseline.json
cat karpathy/results/latest.json
```

---

## Troubleshooting

### "No baseline found"
```bash
npm run karpathy:baseline
```

### "Tasks not generating"
1. Check `karpathy/tasks/task-0X.md` exists
2. Copy requirement to Claude Code
3. Specify agent: `@dan-backend-engineer`
4. Save to `karpathy/output/task-0X/`

### "Build failing"
Review agent's generated code, ask it to fix specific errors, re-save.

### "Tests inconsistent"
- Ensure test data is stable (no random timestamps)
- Check Playwright specs match generated component structure
- Ask agent to ensure components have expected `data-testid` attributes

---

## Next: Customize for Your Domain

This blueprint works for **any codebase**, but you should customize:

1. **Task specs** — Replace generic REST API with your domain's tasks
2. **Agents** — Add your specialized agents (ML, DevOps, etc.)
3. **Success criteria** — Define what "pass" means in your context

Example customization for **finance domain**:

```markdown
# Task: Transaction Processor

Requirement: Build a function that:
- Parses transaction CSV (amount, date, category, account)
- Validates against business rules:
  - Amount > 0
  - Date is business day
  - Category is approved list
  - Account exists
- Returns { valid, error_list }
- Handles duplicates (same amount + date within 1 hour)
- Logs processing for audit trail
```

---

**Version:** 1.0  
**Status:** Ready to replicate  
**Effort:** 6 hours first month, 1–2 hours per week ongoing
