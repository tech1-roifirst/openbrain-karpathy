# Karpathy Test Harness — Quick Start

## 🚀 In 5 Minutes

### 1. Generate All 9 Tasks

For each task 1–9:

```
1. Open karpathy/tasks/task-01-rest-api.md
2. Copy "Requirement" section
3. Paste into Claude Code: @dan-backend-engineer
4. Save output to karpathy/output/task-01/
5. Repeat for task-02 through task-09
```

**Time:** ~5 hours (20–45 min per task)

### 2. Run Tests & Record Baseline

```bash
npm run karpathy:run-all      # Validate all 9 tasks
npm run karpathy:baseline     # Lock in current as baseline
```

**Output:** Shows your baseline pass rate (target: 75%+)

### 3. Modify One Agent

```bash
# Edit the agent prompt
nano .claude/agents/dan-backend-engineer.md

# Add ONE focused change (e.g., stricter validation)
# Save & commit
git add .claude/agents/dan-backend-engineer.md
git commit -m "test(karpathy): add stricter validation"
```

### 4. Re-test Changed Tasks

```bash
npm run karpathy:validate 1   # Task 1
npm run karpathy:validate 2   # Task 2
npm run karpathy:validate 3   # Task 3
npm run karpathy:validate 4   # Task 4
```

### 5. Compare

```bash
npm run karpathy:compare
```

**Output:** Shows if pass rate improved or regressed.

---

## 📊 Sample Results

```
Baseline Pass Rate:  6/9 (66.7%)
Current Pass Rate:   7/9 (77.8%)
Change:              📈 +11.1%

🎉 Improvement detected!
   → Lock in: npm run karpathy:baseline
```

---

## ✅ Next Steps

1. **If improved:** Lock it in
   ```bash
   npm run karpathy:baseline
   git commit -m "test(karpathy): confirmed +11.1% improvement"
   ```

2. **If regressed:** Revert
   ```bash
   git checkout .claude/agents/dan-backend-engineer.md
   npm run karpathy:run-all  # Verify back to baseline
   ```

3. **Try another change** → Repeat from Step 3

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `tasks/task-XX.md` | Copy & paste into Claude Code |
| `output/task-XX/` | Where generated code lives |
| `results/baseline.json` | Your locked benchmark |
| `karpathy/README.md` | Full documentation |

---

## ⏱️ Timeline

| Phase | Time | Steps |
|-------|------|-------|
| Baseline | ~5 hours | Generate 9 tasks + validate |
| Per Experiment | ~1–2 hours | Modify agent + re-test affected tasks |
| Compare | ~5 min | `npm run karpathy:compare` |

**Total to first optimization:** ~6 hours
**Each follow-up experiment:** ~1.5 hours

---

## 🎯 Success Metrics

- **Pass Rate**: % of 9 tasks that compile + tests pass (target: 95%)
- **Improvement**: % change in pass rate from baseline
- **Iteration Speed**: How quickly you can test new optimizations

---

## 🆘 Help

- Detailed docs: `karpathy/README.md`
- Task specs: `KARPATHY_TEST_SUITE.md`
- Agent prompts: `.claude/agents/`

---

**Ready? Start with Step 1 above.** 🚀
