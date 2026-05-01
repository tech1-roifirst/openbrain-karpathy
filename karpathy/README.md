# Karpathy Auto-Improvement Test Harness

This directory contains the test suite and automation for the **Karpathy auto-improvement loop** — a framework for systematically optimizing Claude Code agents that generate code.

## Overview

The harness automates the measurement and comparison cycle:

```
1. Baseline Run        → Record current performance (75% pass rate)
2. Modify Agent Prompt → Change Code Standards or Methodology
3. Test Run            → Re-run all tasks with modified agent
4. Compare             → See if pass rate improved (75% → 85%?)
5. Decide              → Keep or revert the change
```

## Directory Structure

```
karpathy/
├── README.md              # This file
├── tasks/                 # 9 task prompts (copy & paste into Claude Code)
│   ├── task-01-rest-api.md
│   ├── task-02-db-query.md
│   ├── task-03-auth-flow.md
│   ├── task-04-data-processing.md
│   ├── task-05-dashboard.md
│   ├── task-06-form-component.md
│   ├── task-07-schema-design.md
│   ├── task-08-query-optimization.md
│   └── task-09-data-pipeline.md
├── output/               # Generated code goes here (auto-created)
│   └── task-XX/
├── tests/                # Playwright E2E specs
│   ├── task-05.spec.ts   # Dashboard tests
│   └── task-06.spec.ts   # Form tests
├── results/              # Test results (auto-created)
│   ├── baseline.json     # Locked baseline
│   └── experiments/      # Per-run results
└── scripts/              # Automation scripts
    ├── validate.js       # Validate single task
    ├── run-all.js        # Validate all 9 tasks
    ├── record-baseline.js # Lock current as baseline
    └── compare.js        # Compare vs baseline
```

---

## Quick Start

### Step 1: Run Baseline (First Time Only)

**For each of the 9 tasks:**

1. Open `karpathy/tasks/task-01-rest-api.md` in your editor
2. Copy the **Requirement** section
3. Open **Claude Code** and specify the agent: `@dan-backend-engineer`
4. Paste the requirement and let the agent generate code
5. Save the generated code to `karpathy/output/task-01/` directory

Repeat for tasks 2–9.

**Then validate:**

```bash
npm run karpathy:run-all
```

This runs all tasks through build + tests and shows pass rate.

**Lock in baseline:**

```bash
npm run karpathy:baseline
```

This saves `karpathy/results/baseline.json` — your benchmark.

### Step 2: Optimize an Agent

1. Edit one of the agent prompts:
   - `.claude/agents/dan-backend-engineer.md` (tasks 1–4)
   - `.claude/agents/coach-frontend-engineer.md` (tasks 5–6)
   - `.claude/agents/data-engineer.md` (tasks 7–9)
   - `.claude/agents/joey-fullstack-backend.md` (tasks 3, 9)

2. Make ONE focused change. Examples:
   - Add stricter input validation requirement
   - Require more detailed error handling
   - Add performance notes to methodology
   - Update Tech Stack section with new language support

3. Save the change and commit it:
   ```bash
   git add .claude/agents/dan-backend-engineer.md
   git commit -m "test(karpathy): stricter validation requirements"
   ```

### Step 3: Test the Optimization

**Re-generate only the affected tasks** (don't regenerate all 9 each time):

- Modified backend agent (dan)? Re-run tasks 1–4
- Modified frontend agent (coach)? Re-run tasks 5–6
- Modified data agent? Re-run tasks 7–9

For example, if you modified `dan-backend-engineer.md`:

```bash
npm run karpathy:validate 1
npm run karpathy:validate 2
npm run karpathy:validate 3
npm run karpathy:validate 4
```

Or run all to get the full picture:

```bash
npm run karpathy:run-all
```

### Step 4: Compare Results

```bash
npm run karpathy:compare
```

Output example:

```
═══════════════════════════════════════════════════════════
           Baseline vs. Current Comparison
═══════════════════════════════════════════════════════════

Task Results:

Task | Baseline | Current | Change
-----|----------|---------|--------
  1 | ✅      | ✅      | —
  2 | ❌      | ✅      | 📈
  3 | ✅      | ✅      | —
  4 | ✅      | ✅      | —
  5 | ✅      | ✅      | —
  6 | ✅      | ✅      | —
  7 | ✅      | ✅      | —
  8 | ✅      | ✅      | —
  9 | ✅      | ✅      | —

Baseline Pass Rate:  8/9 (88.9%)
Current Pass Rate:   9/9 (100.0%)
Change:              📈 +11.1%

🎉 Improvement detected!
   → Consider: npm run karpathy:baseline (lock in new baseline)
```

### Step 5: Decide

- **If improved:** Lock in the change
  ```bash
  npm run karpathy:baseline
  git commit -m "test(karpathy): improvement confirmed — +X% pass rate"
  ```

- **If regressed:** Revert the agent change
  ```bash
  git checkout .claude/agents/dan-backend-engineer.md
  npm run karpathy:run-all  # Verify it passes again
  ```

- **If flat:** Try a different optimization or deeper change

---

## Commands Reference

### Validate a Single Task

```bash
npm run karpathy:validate 1   # Validates task 1 (REST API)
npm run karpathy:validate 5   # Validates task 5 (Dashboard)
```

Checks:
- Build succeeds (`npm run build`)
- Playwright tests pass (for frontend tasks 5–6)
- Records result to `karpathy/results/experiments/`

### Run All Tasks

```bash
npm run karpathy:run-all
```

- Validates tasks 1–9 sequentially
- Aggregates results
- Displays summary (pass rate, which tasks failed)

### Record Baseline

```bash
npm run karpathy:baseline
```

- Locks current results as baseline
- Saves to `karpathy/results/baseline.json`
- Records agent versions for traceability

### Compare vs Baseline

```bash
npm run karpathy:compare
```

- Loads baseline.json
- Loads latest experiment results
- Shows task-by-task diff
- Calculates pass rate change
- Recommends next step (lock in / revert / try again)

---

## Task Details

Each task file in `karpathy/tasks/` contains:

- **Agent**: Which Claude agent to invoke (`@dan-backend-engineer`, etc.)
- **Objective**: What the agent should build
- **Input Specification**: What data/requirements to provide
- **Output Specification**: What files/structure to generate
- **Success Criteria**: How to measure if it worked
- **Notes**: Tips and constraints

### Task Summary

| # | Task | Agent | Time |
|---|------|-------|------|
| 1 | REST API + Validation | dan-backend-engineer | 25–30 min |
| 2 | Database Query | dan-backend-engineer | 20–25 min |
| 3 | Auth Flow | joey-fullstack-backend | 30–40 min |
| 4 | Data Processing | dan-backend-engineer | 25–30 min |
| 5 | Dashboard | coach-frontend-engineer | 35–45 min |
| 6 | Form | coach-frontend-engineer | 20–25 min |
| 7 | Schema Design | data-engineer | 20–25 min |
| 8 | Query Optimization | data-engineer | 25–30 min |
| 9 | Data Pipeline | joey-fullstack-backend | 30–40 min |

---

## Results Files

### `baseline.json`

Locked benchmark results. Example:

```json
{
  "recordedAt": "2026-04-30T15:32:00.000Z",
  "passRate": {
    "passCount": 8,
    "totalTasks": 9,
    "percentage": "88.9"
  },
  "tasks": {
    "01": { "task": 1, "passed": true, ... },
    "02": { "task": 2, "passed": false, ... },
    ...
  },
  "metadata": {
    "agentVersions": {
      "dan-backend-engineer.md": "2026-04-30T14:00:00.000Z",
      ...
    }
  }
}
```

### `experiments/<timestamp>.json`

Per-task result files from each validation run. Used to aggregate and compare.

---

## Tips for Optimization

### Good Optimizations (Likely to Improve Pass Rate)

1. **Stricter Input Validation**
   - Require all endpoints validate at boundaries
   - Add specific rules (email format, password length)

2. **Explicit Error Handling**
   - Define specific error codes for each failure mode
   - Require field-level error details in responses

3. **Performance Notes**
   - Add indexing guidance in methodology
   - Require N+1 query detection and prevention

4. **Security Checklists**
   - Add OWASP compliance checks
   - Require specific hash algorithms, token expiration, etc.

5. **Code Quality Patterns**
   - Define preferred patterns (DRY, Single Responsibility)
   - Add style guidelines (naming, file structure)

### How to Find What to Optimize

1. **Review failed tasks** — What code patterns failed?
2. **Check error messages** — What validation was missing?
3. **Look at agent memory** — What patterns were already noted?
4. **Read Code Standards** — Are they clear and complete?

### Measurement Timeline

- **Week 1**: Baseline run + first 2–3 optimizations
- **Week 2**: 3–5 more experiments, accumulate learnings
- **Week 3–4**: Consolidated changes, measure final improvement

**Expected outcome:** 10–15% improvement in pass rate (75% → 85–87%)

---

## Troubleshooting

### "Output directory not found"

You haven't generated code for that task yet.

**Solution:**
1. Open `karpathy/tasks/task-XX.md`
2. Copy the requirement
3. Paste into Claude Code with the specified agent
4. Save generated code to `karpathy/output/task-XX/`

### "Build failed"

The generated code has TypeScript/syntax errors.

**Solution:**
1. Review the agent's generated code
2. Either fix it manually, or ask the agent to fix specific errors
3. Re-save to `karpathy/output/task-XX/`
4. Run validation again

### "Playwright tests failed"

Tests for frontend tasks (5, 6) didn't pass.

**Solution:**
1. Check the Playwright spec in `karpathy/tests/task-0X.spec.ts`
2. Review what the test expects (data-testid, role, text)
3. Ask agent to ensure generated component has those attributes
4. Re-run validation

### "No baseline found"

You haven't recorded a baseline yet.

**Solution:**
```bash
npm run karpathy:run-all          # Validate all 9 tasks
npm run karpathy:baseline        # Lock in as baseline
```

---

## Notes

- Each task takes **20–45 minutes** to generate and validate (depending on complexity)
- A full baseline run is **~4–5 hours** (all 9 tasks manually generated + validated)
- Optimization experiments are faster — just re-run affected tasks (~1 hour for backend tasks)
- Results are deterministic (same code = same test result) — random variation is minimal
- Keep agent changes small and focused — one optimization per experiment for clarity

---

## See Also

- `KARPATHY_TEST_SUITE.md` — Full specification of all 9 tasks
- `.claude/agents/` — Agent definitions to optimize
- `.claude/CLAUDE.md` — Global instructions and preferences

---

**Ready to optimize?**

```bash
# Step 1: Run baseline
npm run karpathy:run-all
npm run karpathy:baseline

# Step 2: Edit an agent prompt (e.g., dan-backend-engineer.md)
# Step 3: Test changed tasks
npm run karpathy:validate 1
npm run karpathy:validate 2

# Step 4: Compare results
npm run karpathy:compare
```
