# OB1 Recipes Guide
**How to Use Community Recipes in Your Agent Workflow**

---

## Overview

OB1 has **20+ community-built recipes** — ready-to-use workflows that handle data import, capture automation, and knowledge extraction. This guide shows how to integrate them into your agent enhancement system to speed up learning capture and knowledge extraction.

---

## 🎯 What Are Recipes?

Recipes are **self-contained, battle-tested workflows** that solve specific problems:

```
Data Import Recipes:
├─ ChatGPT conversations → OB1
├─ Gmail history → OB1
├─ Twitter/X → OB1
├─ Obsidian vault → OB1
└─ ... (8+ more data sources)

Automation Recipes:
├─ Auto-capture session summaries
├─ Panning for Gold (mine brain dumps)
├─ Life Engine (proactive briefing)
├─ Daily digest delivery
└─ ... (7+ more automation workflows)

Knowledge Recipes:
├─ Aiception (self-improving systems)
├─ Schema-aware routing
├─ Fingerprint dedup
└─ ... (4+ more knowledge tools)
```

Each recipe is in `OB1/recipes/` as a self-contained folder with:
- `README.md` (how to use it)
- `metadata.json` (requirements)
- `implementation/` (code/scripts)
- Contributor info

---

## 📋 Recipe Categories & Usage

### Category 1: AUTO-CAPTURE & SUMMARIZATION

**Best for:** Automatically saving agent improvement learnings

#### Recipe: `auto-capture`

**What it does:**
- Automatically captures "ACT NOW" items at session end
- Captures session summaries (what happened, what changed)
- Saves to OB1 with automatic metadata extraction

**Use in your workflow:**
```
Agent Optimization Session:
├─ Monday morning: Query OB1
├─ Tue-Wed: Modify agent
├─ Thursday: Test
├─ Friday: Measure results
│  │
│  └─ At session end:
│     ├─ Auto-capture runs
│     ├─ Extracts: "Validation improvement +25%"
│     ├─ Adds metadata: agent, project, improvement
│     └─ Saves to OB1 automatically
│
└─ No manual "/learn" command needed!
```

**How to set up:**

```bash
# 1. Copy recipe
cp -r OB1/recipes/auto-capture ./recipes/

# 2. In Claude Code settings, add:
settings.json:
{
  "hooks": {
    "sessionClose": {
      "command": "node",
      "args": ["recipes/auto-capture/capture.js"],
      "env": {
        "SUPABASE_URL": "your-url",
        "SUPABASE_KEY": "your-key"
      }
    }
  }
}

# 3. At session end, Claude Code runs capture automatically
```

**Expected output:**
```json
{
  "content": "Improved dan-backend-engineer validation handling. Added field-level error requirement. Pass rate: 50% → 75%. +25% improvement.",
  "metadata": {
    "type": "agent_optimization",
    "agent": "dan-backend-engineer",
    "project": "FULLSOURCE_ETG",
    "improvement_percentage": 25,
    "status": "locked_in",
    "date": "2026-05-02T17:30:00Z"
  },
  "tags": ["validation", "error-handling", "backend"]
}
```

---

#### Recipe: `panning-for-gold`

**What it does:**
- Mines your session notes/brain dumps for actionable insights
- Extracts decisions, patterns, problems, solutions
- Saves structured insights to OB1

**Use in your workflow:**

```
End of optimization week:
├─ Review your session notes
├─ Run "Panning for Gold"
│  ├─ Extracts: "Validation helps with field-level errors"
│  ├─ Extracts: "JWT expiration still failing"
│  ├─ Extracts: "N+1 queries not yet tested"
│  └─ Saves as structured insights to OB1
└─ Much richer than manual notes!
```

**Setup:**

```bash
# 1. Copy recipe
cp -r OB1/recipes/panning-for-gold ./recipes/

# 2. After each Friday optimization session:
npm run pan-for-gold < session-notes.md

# 3. Result: Structured insights saved to OB1
```

**Example extraction:**

```
Input (your messy notes):
"Tried validation fix. Works great - now returning field errors. 
Task 1 passes. Task 2 still broken - JWT not expiring. Need to test N+1 
next week. Cool pattern I noticed - agents respond better with examples."

Output (structured):
Insights:
├─ Pattern (LOCKED): Field-level validation errors → +25% improvement
├─ Problem (OPEN): JWT token expiration logic broken
├─ Task (NEXT): Test N+1 query prevention
└─ Learning (NEW): Agents respond better with Code Standard examples
```

---

### Category 2: DATA IMPORT RECIPES

**Best for:** Importing past project knowledge into OB1

#### Recipe: `chatgpt-conversation-import`

**What it does:**
- Imports ChatGPT conversation history
- Filters out trivial conversations
- Summarizes conversations via LLM
- Saves to OB1 with full metadata

**Use case:**
```
You've optimized agents in past projects but haven't captured learnings.
├─ Export past ChatGPT conversations
├─ Run import recipe
├─ Conversations → OB1 (with summaries)
└─ Now searchable: "What worked for validation?"
```

---

#### Recipe: `obsidian-vault-import`

**What it does:**
- Imports your Obsidian vault notes
- Preserves metadata (tags, dates, relationships)
- Embeds and indexes in OB1

**Use case:**
```
You've kept notes in Obsidian about agent patterns.
├─ Run vault import
├─ All notes → OB1 vector database
├─ Search by meaning: "Show me validation improvements"
└─ Find notes you forgot you had!
```

**Setup:**

```bash
# 1. Export your Obsidian vault
Obsidian → Settings → About → Export vault

# 2. Run import
cp -r OB1/recipes/obsidian-vault-import ./recipes/
npm run import-obsidian ./your-vault-export.zip

# 3. Watch it load into OB1
# All notes now searchable + embedded
```

---

#### Recipe: `email-history-import`

**What it does:**
- Imports Gmail history
- Parses emails
- Extracts conversations about agent work
- Saves to OB1

**Use case:**
```
Your team discussed agent improvements via email.
├─ Run email import
├─ Email threads → OB1
├─ Query: "What did we say about validation?"
└─ Find consensus from past team discussions
```

---

### Category 3: AUTOMATION & WORKFLOW RECIPES

#### Recipe: `life-engine`

**What it does:**
- Personal assistant that tracks habits, schedule, health
- Generates daily briefings
- Proactive recommendations

**Use in agent workflow:**
```
Agent Optimization Habit Tracking:
├─ Life Engine tracks your weekly optimization schedule
├─ Every Monday 9am: "Time for agent optimization, review OB1"
├─ Every Friday: "Optimization session summary?"
├─ Monthly: "You've completed 4 optimizations, here's the trend"
└─ Keeps you on track
```

**Setup:**

```bash
# Copy recipe
cp -r OB1/recipes/life-engine ./recipes/

# Configure for agent optimization
life-engine.config.json:
{
  "habits": [
    {
      "name": "Agent Optimization",
      "frequency": "weekly",
      "day": "monday",
      "time": "09:00"
    }
  ],
  "metrics": [
    "pass_rate_improvement",
    "agents_optimized",
    "patterns_locked_in"
  ]
}
```

---

#### Recipe: `daily-digest`

**What it does:**
- Creates daily digest of recent thoughts
- Delivers via email/Slack
- Surfaces important learnings

**Use case:**
```
Every morning:
├─ Daily digest summarizes yesterday's optimizations
├─ Highlights: +25% improvement, validation locked in
├─ Trends: Pass rate trending up 5% per week
└─ Delivered to email/Slack
```

---

### Category 4: KNOWLEDGE EXTRACTION RECIPES

#### Recipe: `claudeception` / `aiception`

**What it does:**
- Self-improving system that creates new skills from work
- Skills that create other skills
- Autonomous improvement loop

**Use case:**
```
Your agent improvement work gets smarter over time:
├─ Week 1: Human reviews baseline, creates pattern
├─ Week 2: Aiception extracts pattern as reusable skill
├─ Week 3: New agents load skill automatically
├─ Week 4: Aiception creates meta-skill about meta-skills
│
Result: Agents keep improving even while you sleep!
```

---

#### Recipe: `schema-aware-routing`

**What it does:**
- Routes unstructured learning notes to right database tables
- Automatically categorizes (pattern vs problem vs learning)
- Uses LLM to understand meaning

**Use case:**
```
You write messy improvement notes:
"Validation works great for field errors. JWT still broken. 
Should test N+1 queries. Agents really like examples in Code Standards."

Schema-aware routing:
├─ Routes to patterns: field-level-validation
├─ Routes to problems: JWT-expiration
├─ Routes to tasks: test-N+1
├─ Routes to learnings: agents-like-examples
└─ All automatically organized!
```

---

## 🚀 Integration Workflow: Recipes + Karpathy

```
WEEK 1: BASELINE
├─ Generate 9 tasks
├─ Run karpathy:run-all
├─ 📊 Recipe: Panning for Gold
│  └─ Mine baseline notes → OB1 insights
└─ Save: "Baseline: 66% (6/9)"

WEEK 2: FIRST OPTIMIZATION
├─ Modify agent
├─ Re-test
├─ 🧠 Recipe: Auto-capture
│  └─ Session end → automatic capture
├─ 📊 Recipe: Panning for Gold
│  └─ Extract insights from session
└─ OB1 now knows: "Validation +25%"

WEEK 3: SECOND OPTIMIZATION
├─ Query OB1 (which recipes found?)
├─ Modify different agent
├─ 📧 Recipe: Daily-digest
│  └─ Email summary of week's improvements
├─ 🧠 Recipe: Auto-capture
│  └─ Automatic capture again
└─ OB1: "Error handling +15%"

WEEK 4: CONSOLIDATION
├─ 🤖 Recipe: Aiception
│  └─ Extract improvements as reusable skills
├─ 📋 Recipe: Schema-aware-routing
│  └─ Organize all learnings into categories
└─ Monthly summary in OB1
   ├─ Patterns locked in
   ├─ Improvements documented
   └─ Skills created for next project

NEXT PROJECT:
├─ 📥 Recipe: Obsidian-import (import past notes)
├─ 📥 Recipe: ChatGPT-import (import past conversations)
├─ 🤖 Recipe: Aiception
│  └─ Load skills from Project 1
├─ New baseline: 80% (vs 67%)
└─ Only need +15% instead of +24%
```

---

## 📊 Recipe Value by Agent Task

| Recipe | Agent Tasks | Value | Effort |
|--------|-----------|-------|--------|
| Auto-capture | 1-9 | Save learnings automatically | 30 min setup |
| Panning for Gold | 1-9 | Mine insights from sessions | 15 min per use |
| Aiception | 1-9 | Create reusable skills | 45 min to learn |
| Daily-digest | 1-9 | Stay informed of progress | 20 min setup |
| Schema-routing | 1-9 | Auto-organize learnings | 1 hour setup |
| ChatGPT import | 5-6 | Recover past learning | 30 min |
| Obsidian import | 1-9 | Backfill historical data | 30 min |
| Email import | 1-9 | Surface past discussions | 45 min |
| Life Engine | 1-9 | Habit tracking & reminders | 1 hour |

---

## ✅ Recipe Setup Checklist

**High Priority (Week 1):**
```
□ Auto-capture (save learnings automatically)
□ Panning for Gold (extract session insights)
```

**Medium Priority (Week 2):**
```
□ Daily-digest (stay informed)
□ Aiception (create reusable skills)
```

**Low Priority (Later):**
```
□ Data imports (when you have past projects)
□ Life Engine (optional habit tracking)
□ Schema routing (advanced organization)
```

---

## 🔗 How Recipes Connect to Karpathy Loop

```
Karpathy Loop:
├─ Generate tasks
├─ Test agents
├─ Measure improvement
├─ Update agents
└─ Repeat

Recipes Enhance:
├─ Auto-capture: Automatic learning capture (no manual notes)
├─ Panning for Gold: Extract actionable insights (better notes)
├─ Daily-digest: Summarize progress (stay motivated)
├─ Aiception: Auto-create skills (compounding improvement)
├─ Schema-routing: Organize learnings (better discovery)
└─ Data import: Backfill historical knowledge (faster baselines)
```

---

## 💾 Recipe File Structure

Each recipe in OB1 is organized:

```
OB1/recipes/auto-capture/
├─ README.md                    (How to use)
├─ metadata.json               (Requirements)
├─ implementation/
│  ├─ capture.js              (Main script)
│  ├─ config.template.json    (Config template)
│  └─ schemas/                (Database schemas)
├─ examples/
│  ├─ session-summary.md      (Example output)
│  └─ config.example.json     (Example config)
└─ LICENSE                     (Open source)
```

**To use a recipe:**

```bash
# 1. Copy to your project
cp -r OB1/recipes/auto-capture ./recipes/

# 2. Read README.md
cat recipes/auto-capture/README.md

# 3. Set up config
cp recipes/auto-capture/config.template.json recipes/auto-capture/config.json
# Edit config.json with your Supabase credentials

# 4. Run
npm run recipe:auto-capture

# 5. Check OB1 for results
# Query OB1: "Show auto-captured learnings from agent optimization"
```

---

## 🎯 Quick Recipe Reference

### Need to... | Recipe | Time |
|---|---|---|
| Save learnings automatically | auto-capture | 30 min |
| Mine insights from notes | panning-for-gold | 15 min |
| Import past conversations | chatgpt-conversation-import | 30 min |
| Import past notes | obsidian-vault-import | 30 min |
| Auto-organize learnings | schema-aware-routing | 1 hour |
| Daily briefing | daily-digest | 20 min |
| Track habits | life-engine | 1 hour |
| Create reusable skills | aiception | 45 min |
| Remove duplicate learnings | fingerprint-dedup-backfill | 30 min |

---

## 🚀 Implementation Order

**Week 1: Core Capture**
```
1. Set up auto-capture
2. Set up panning-for-gold
→ Result: Automatic + insightful learning capture
```

**Week 2: Enhanced Workflow**
```
3. Set up daily-digest
4. Set up aiception
→ Result: Informed + self-improving workflow
```

**Week 3: Knowledge Integration**
```
5. Set up schema-aware-routing
6. Import past data (ChatGPT, Obsidian)
→ Result: Rich, organized knowledge base
```

**Week 4+: Continuous Improvement**
```
7. Maintain recipes
8. Review monthly summaries
9. Iterate based on insights
→ Result: Compounding, self-improving system
```

---

## 📊 Expected Improvement with Recipes

**Without Recipes:**
```
Project 1: 66% → 90% (manual notes, memory files)
Project 2: 67% → 85% (manually transfer knowledge)
Project 3: 66% → 82% (some carryover)
```

**With Recipes:**
```
Project 1: 66% → 90% (auto-capture, auto-insights)
           └─ Knowledge automatically organized
Project 2: 80% → 95% (auto-imported learnings)
           └─ Better baseline from Project 1
Project 3: 85% → 98% (compounded knowledge)
           └─ Even better baseline
```

**Benefits:**
- ✅ Less manual work (recipes automate capture)
- ✅ Better insights (recipes extract meaning)
- ✅ Faster baselines (recipes enable knowledge reuse)
- ✅ Compounding improvement (recipes track trends)

---

**Version:** 1.0  
**Status:** Ready to implement  
**Setup time:** 2-3 hours for core recipes  
**Ongoing effort:** Automatic (recipes handle it)  
**Payoff:** Better baselines + faster improvements
