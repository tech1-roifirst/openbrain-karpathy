# Agent Enhancement — Quick Reference Card
**Copy this for new projects. Tape to desk during Week 1.**

---

## 🚀 Quick Setup (1 Hour)

```bash
# 1. Create folder structure
mkdir -p your-project/karpathy/{tasks,output,tests,scripts,results}

# 2. Copy these files from current project
cp karpathy/tasks/*.md              your-project/karpathy/tasks/
cp karpathy/README.md               your-project/karpathy/
cp karpathy/QUICKSTART.md           your-project/karpathy/
cp KARPATHY_TEST_SUITE.md           your-project/

# 3. Create validate.js script
# See: AGENT_ENHANCEMENT_SYSTEM.md Phase 1, Step 1.4

# 4. Add to package.json
"karpathy:validate": "node karpathy/scripts/validate.js",
"karpathy:run-all": "node karpathy/scripts/run-all.js",
"karpathy:baseline": "node karpathy/scripts/record-baseline.js",
"karpathy:compare": "node karpathy/scripts/compare.js"

# 5. Initialize memory
mkdir -p .claude/projects/your-project/memory
touch .claude/projects/your-project/memory/MEMORY.md
```

---

## 📅 Weekly Enhancement Cycle (1–2 Hours)

### Monday (9 AM)
```bash
# 1. Check last week's results
npm run karpathy:compare

# Output looks like:
# Baseline: 66.7% (6/9)
# Current:  77.8% (7/9)
# Change:   📈 +11.1%
```

### Monday–Wednesday (Pick ONE optimization)

```bash
# 1. Open failing task's results
cat karpathy/results/baseline.json | jq '.tasks[] | select(.passed == false)'

# 2. Edit agent prompt (ONE change only!)
nano .claude/agents/dan-backend-engineer.md

# Example change:
# ADD to Code Standards section:
# "All endpoints MUST validate input and return 400 with { field: "error" }"

# 3. Commit change
git add .claude/agents/dan-backend-engineer.md
git commit -m "test(karpathy-week1): require field-level validation errors"
```

### Thursday (Test & Measure)

```bash
# Only re-test affected tasks (saves 2+ hours!)
npm run karpathy:validate 1
npm run karpathy:validate 2
npm run karpathy:validate 3
npm run karpathy:validate 4

# Compare results
npm run karpathy:compare

# Output: Did pass rate improve?
```

### Friday (Decide)

**If improved:**
```bash
npm run karpathy:baseline
git commit -m "test(karpathy-week1): +X% improvement confirmed"
```

**If flat or regressed:**
```bash
git checkout .claude/agents/dan-backend-engineer.md
npm run karpathy:run-all  # Verify back to baseline
```

---

## 📊 Decision Tree

```
Did pass rate improve?

    YES (50% → 75%)
    ├─ 🎉 Lock it in!
    ├─ npm run karpathy:baseline
    ├─ git commit -m "improvement confirmed"
    └─ Save to memory/optimization_week_X.md
    
    NO CHANGE (50% → 50%)
    ├─ Try different angle next week
    ├─ Example: Last week was validation,
    │           this week try error handling
    └─ Keep track of failed ideas
    
    REGRESSED (50% → 30%)
    ├─ ❌ Revert immediately!
    ├─ git checkout .claude/agents/...
    ├─ npm run karpathy:run-all
    └─ Verify back to baseline
```

---

## 🧠 Memory Updates (Friday Afternoon)

After each week, **save learnings**:

```markdown
# memory/optimization_week_1.md

---
name: Validation Requirement Week 1
type: feedback
---

**What Changed:**
Added to dan-backend-engineer Code Standards:
"All endpoints MUST return 400 with { field: 'error message' } format"

**Results:**
Before: 2/4 pass (50%)
After:  3/4 pass (75%)
**Improvement: +25% ✅**

**Why It Worked:**
Agents weren't thinking about error structure until explicitly required.

**Locked In?** 
YES — Keep this in Code Standards permanently.

**Next Week Focus:**
Task 3 (Auth Flow) still failing. Try JWT expiration logic next.
```

---

## 📈 4-Week View

| Week | Action | Target | Status |
|------|--------|--------|--------|
| 1 | Baseline run + first optimization | 75% | — |
| 2 | Second optimization (different agent) | 80% | — |
| 3 | Consolidate wins + risky experiment | 82% | — |
| 4 | Lock everything + review month | 85%+ | — |

**If stuck:** Try a different angle (e.g., switch from validation → error handling → security)

---

## 🔥 Common Patterns That Work

### ✅ High-Confidence Improvements

1. **Validation Errors** (+15–20%)
   - Add: "Always return { field: 'error' } for 400s"
   - Why: Agents don't think about error structure otherwise

2. **Query Optimization** (+10–15%)
   - Add: "Prevent N+1 queries; explain indexing strategy"
   - Why: Agents need explicit guidance on joins vs loops

3. **Error Handling** (+10–15%)
   - Add: "Define specific error codes for each failure mode"
   - Why: Agents default to generic "error" messages

### ❌ Low-Confidence / Risky

1. **Strict Typing** (often regresses)
   - Too verbose, agents generate bloated code
   - Skip unless domain-critical

2. **Code Comments Mandate** (often regresses)
   - Agents add unhelpful comments
   - Let code speak for itself

3. **Security Audits** (needs expertise)
   - Don't guess; consult security team first

---

## 🆘 Troubleshooting Map

| Problem | Fix | Time |
|---------|-----|------|
| "Output not found" | Generate task manually, paste into Claude Code, save to output/task-XX/ | 20 min |
| "Build failed" | Review generated code, ask agent to fix errors | 10 min |
| "Tests inconsistent" | Check task spec expectations, ensure components have correct `data-testid` | 15 min |
| "No improvement" | Try different optimization (validation → error handling → security) | Next week |
| "Results regressed" | `git checkout` agent file, verify baseline, try opposite change | 10 min |

---

## 📌 Don't Forget

- ✅ **Save one optimization per week** — not multiple in parallel
- ✅ **Only re-test affected tasks** — saves hours
- ✅ **Lock in wins immediately** — don't postpone baseline updates
- ✅ **Update memory weekly** — future you needs these notes
- ✅ **Share results with team** — builds momentum + accountability
- ❌ **Don't revert without testing** — always verify it actually works
- ❌ **Don't guess at security** — consult security team first
- ❌ **Don't test everything at once** — one change per week, clear causality

---

## 📱 Slack/Email Template (Share Weekly)

```
🤖 Agent Enhancement Week 1 Results

Baseline:  6/9 tasks pass (66.7%)
Current:   7/9 tasks pass (77.8%)
Improvement: 📈 +11.1%

✅ What worked:
Added field-level validation requirement to dan-backend-engineer

❌ What's next:
Task 3 (Auth Flow) needs JWT expiration logic
Task 9 (Data Pipeline) needs error handling

🎯 Target: 85% by end of month
```

---

## 🎯 Success Metrics (Track These)

```
Week 1: Baseline established
        [6/9 pass] (66.7%)

Week 2: First optimization
        [7/9 pass] (77.8%) — ✅ +11.1%

Week 3: Second optimization
        [8/9 pass] (88.9%) — ✅ +11.1% 

Week 4: Third optimization
        [8/9 pass] (88.9%) — — flat
        Revert week 3, try different angle

Month 1 Total: 66.7% → 88.9% = +22.2% 🎉
```

---

## 📂 Files You Need

```
your-project/
├── karpathy/
│   ├── tasks/task-0X.md          ← Copy from current project
│   ├── output/task-0X/            ← Auto-generated
│   ├── tests/task-0X.spec.ts      ← Playwright specs
│   ├── scripts/validate.js        ← Copy + customize
│   ├── results/baseline.json      ← Auto-generated
│   ├── README.md                  ← Copy from current
│   └── QUICKSTART.md              ← Copy from current
│
├── .claude/
│   ├── agents/
│   │   ├── dan-backend-engineer.md
│   │   ├── coach-frontend-engineer.md
│   │   └── data-engineer.md
│   │
│   └── projects/your-project/memory/
│       ├── MEMORY.md              ← Index file
│       ├── baseline_run.md
│       ├── optimization_week_1.md
│       └── agent_dan_learnings.md
│
└── package.json                   ← Add npm scripts
```

---

## 🚨 Critical Path (Don't Skip)

1. ✅ **Copy infrastructure** (30 min)
2. ✅ **Generate baseline** (5 hours, one-time investment)
3. ✅ **Run baseline measurement** (5 min)
4. ✅ **First optimization** (2 hours)
5. ✅ **Measure impact** (5 min)
6. ✅ **Lock in or revert** (10 min)

**Total to first result:** 6.5–7 hours over 3 days

---

## 📞 When to Ask for Help

| Situation | Action |
|-----------|--------|
| "Agent generates broken code" | Ask agent to fix errors, don't modify manually |
| "Test fails on valid code" | Review test spec, adjust task or component |
| "Can't decide what to optimize" | Review baseline.json, pick agent with lowest pass rate |
| "Improvement seems fake" | Rerun task twice independently, ensure consistent |
| "Stuck at 75% forever" | Switch agents (try coach-frontend instead) |

---

**Version:** 1.0  
**Print this** → tape to monitor → use weekly  
**Estimated ROI:** 10–15% improvement in code quality within 4 weeks
