# OB1 Extensions Deep Dive
**Explore, Learn, and Build from OB1's Curated Learning Path**

---

## Overview

OB1 has **6 extensions** arranged in a **learning path**. Each builds on the previous, teaching new concepts through something you'll actually build.

This guide deep-dives into all 6, shows which ones map to your agent workflow, and explains how to adapt them.

---

## 🎯 The 6 Extensions (Learning Path)

```
Extension 1: Household Knowledge Base
└─ Goal: Store facts your agent can recall
   └─ Difficulty: Beginner
   └─ Skills: Database schema, metadata tagging
   └─ Time: 2-3 hours
   └─ Maps to: Storing agent learnings

Extension 2: Home Maintenance Tracker
└─ Goal: Schedule and history for home upkeep
   └─ Difficulty: Beginner
   └─ Skills: Timestamps, recurring tasks
   └─ Time: 2-3 hours
   └─ Maps to: Tracking optimization cycles

Extension 3: Family Calendar
└─ Goal: Multi-person schedule coordination
   └─ Difficulty: Intermediate
   └─ Skills: Row Level Security (RLS), sharing
   └─ Time: 3-4 hours
   └─ Maps to: Multi-agent coordination

Extension 4: Meal Planning
└─ Goal: Recipes, meals, shared grocery lists
   └─ Difficulty: Intermediate
   └─ Skills: Relationships, aggregations
   └─ Time: 4-5 hours
   └─ Maps to: Complex data relationships

Extension 5: Professional CRM
└─ Goal: Contact tracking wired to thoughts
   └─ Difficulty: Intermediate
   └─ Skills: Many-to-many relationships, full search
   └─ Time: 5-6 hours
   └─ Maps to: Agent interaction tracking

Extension 6: Job Hunt Pipeline
└─ Goal: Application tracking and interviews
   └─ Difficulty: Advanced
   └─ Skills: State machines, workflows
   └─ Time: 6-8 hours
   └─ Maps to: Agent improvement pipeline
```

---

## 📚 Extension 1: Household Knowledge Base

### What It Teaches
- Basic Supabase table structure
- Metadata tagging
- Simple vector search

### How It Maps to Agent Enhancement
```
Household Knowledge:
├─ Store: "Home maintenance schedule"
├─ Tag: { room: "kitchen", frequency: "monthly" }
└─ Search: "Show all monthly tasks"

Agent Enhancement:
├─ Store: "Agent improvement patterns"
├─ Tag: { agent: "dan", improvement: 25%, type: "validation" }
└─ Search: "Show all validation patterns"
```

### Your Adaptation for Agent Learning

Instead of home facts, store **agent patterns**:

```sql
CREATE TABLE agent_patterns (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz default now()
);

-- Examples to store:
-- "Field-level validation errors improves pass rate by 25%"
-- "N+1 query prevention critical for data-engineer tasks"
-- "JWT expiration handling tested in task-03"
```

**Key learnings:**
- ✅ How to structure metadata for future filtering
- ✅ How to tag information for categorization
- ✅ How to make stored information retrievable

**Time to adapt:** 30 minutes

---

## 📚 Extension 2: Home Maintenance Tracker

### What It Teaches
- Timestamps and scheduling
- Recurring events
- Status tracking (pending, done, failed)

### How It Maps to Agent Enhancement
```
Home Maintenance:
├─ Task: "Kitchen maintenance"
├─ Frequency: "Monthly"
├─ Status: "Done", "In Progress", "Failed"
└─ Next due: 2026-06-01

Agent Enhancement:
├─ Task: "Optimize dan-backend-engineer"
├─ Frequency: "Weekly"
├─ Status: "Completed", "In Progress", "Failed"
└─ Next due: 2026-05-08
```

### Your Adaptation for Optimization Tracking

```sql
CREATE TABLE optimization_runs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  target_agent varchar,
  change_description text,
  status varchar, -- pending, in_progress, completed, failed
  pass_rate_before int,
  pass_rate_after int,
  improvement_percent int,
  locked_in boolean,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Example entry:
-- agent_name: dan-backend-engineer
-- status: completed
-- pass_rate_before: 50
-- pass_rate_after: 75
-- improvement_percent: 25
-- locked_in: true
```

**Key learnings:**
- ✅ How to track state transitions (pending → done)
- ✅ How to schedule recurring work
- ✅ How to measure before/after metrics

**Time to adapt:** 45 minutes

---

## 📚 Extension 3: Family Calendar

### What It Teaches
- **Row Level Security (RLS)** — Crucial for multi-user systems
- Sharing data between users
- Calendar logic and recurring events

### How It Maps to Agent Enhancement
```
Family Calendar:
├─ Multiple family members
├─ Each sees only their events (RLS)
├─ Shared calendar for family
└─ Recurring events (weekly meeting)

Agent Enhancement Multi-Team:
├─ Multiple engineers
├─ Each sees their optimization work
├─ Shared agent definitions
├─ Recurring: Weekly optimization cycles
```

### Your Adaptation for Multi-Engineer Teams

If your team shares agents, use RLS:

```sql
-- Enable RLS for optimization_runs
ALTER TABLE optimization_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Users see only their own optimizations
CREATE POLICY "Users see own optimizations"
ON optimization_runs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Only creator can edit
CREATE POLICY "Users edit own optimizations"
ON optimization_runs
FOR UPDATE
USING (auth.uid() = user_id);
```

**Key learnings:**
- ✅ How to use RLS for data isolation
- ✅ How to create shareable-but-private views
- ✅ How to enforce ownership in multi-user systems

**Time to adapt:** 1-2 hours (RLS is more complex)

**Advanced use case:**
```
Team A (Frontend optimization):
├─ Works on coach-frontend-engineer
├─ Sees only their optimizations
└─ Shared: agent definitions, patterns

Team B (Backend optimization):
├─ Works on dan-backend-engineer
├─ Sees only their optimizations
└─ Shared: agent definitions, patterns

Shared Dashboard:
├─ Show all teams' improvements
├─ Filter by team (RLS handles privacy)
└─ Celebrate wins together
```

---

## 📚 Extension 4: Meal Planning

### What It Teaches
- Complex data relationships (recipes ↔ ingredients ↔ meals)
- Aggregations (total calories, ingredients needed)
- Search across relationships

### How It Maps to Agent Enhancement
```
Meal Planning:
├─ Recipes (ingredients + steps)
├─ Meals (collection of recipes)
├─ Ingredients (units, quantities)
└─ Search: "Meals under 500 calories"

Agent Optimization:
├─ Patterns (techniques + requirements)
├─ Improvements (collection of patterns)
├─ Code Standards (units: validation, error-handling, etc.)
└─ Search: "Improvements under 2 hours effort"
```

### Your Adaptation for Pattern Dependencies

```sql
-- Patterns have dependencies
CREATE TABLE patterns (
  id uuid primary key,
  name text,
  description text,
  improvement_percent int,
  effort_hours int,
  created_at timestamptz
);

-- Some patterns require others first
CREATE TABLE pattern_dependencies (
  pattern_id uuid references patterns(id),
  depends_on_pattern_id uuid references patterns(id),
  primary key (pattern_id, depends_on_pattern_id)
);

-- Example:
-- "Specific error codes" depends on "Field-level validation"
-- Can't implement second without first

-- Search: "Show patterns that unlock the most improvement"
SELECT p.*, COUNT(d.pattern_id) as blocks_count
FROM patterns p
LEFT JOIN pattern_dependencies d ON p.id = d.depends_on_pattern_id
WHERE p.improvement_percent > 15
ORDER BY blocks_count DESC;
```

**Key learnings:**
- ✅ How to model complex relationships
- ✅ How to query across multiple tables
- ✅ How to find "optimal path" through dependencies

**Time to adapt:** 2-3 hours

**Advanced use:**
```
Pattern Graph:
├─ Field-level validation (no dependencies, +25%)
│  └─ unlocks Specific error codes (+15%)
│     └─ unlocks Error recovery (+10%)
├─ N+1 query prevention (no dependencies, +18%)
│  └─ unlocks Index strategy (+8%)
└─ JWT security (no dependencies, +12%)

Recommendation engine:
"To reach 95%, do these 3 patterns in this order"
```

---

## 📚 Extension 5: Professional CRM

### What It Teaches
- Many-to-many relationships (contacts ↔ companies ↔ conversations)
- Full-text + vector search
- Wiring external data into your brain

### How It Maps to Agent Enhancement
```
Professional CRM:
├─ Contacts (people)
├─ Companies (organizations)
├─ Conversations (discussions)
└─ Linked: What did person X say about topic Y?

Agent Enhancement CRM:
├─ Agents (entities)
├─ Code Standards (topics)
├─ Test results (conversations)
└─ Linked: What did agent X do on standard Y?
```

### Your Adaptation for Agent Interaction Tracking

```sql
-- Track which agents struggled with which standards
CREATE TABLE agent_standard_interactions (
  id uuid primary key,
  agent_id uuid references agents(id),
  standard_id uuid references code_standards(id),
  test_result_id uuid references test_results(id),
  passed boolean,
  notes text,
  created_at timestamptz
);

-- Full-text search: Find all interactions for a standard
SELECT *
FROM agent_standard_interactions
WHERE standard_id = $1
ORDER BY created_at DESC;

-- Graph: Which agent + standard combos fail most?
SELECT a.name, s.name, COUNT(*) as failures
FROM agent_standard_interactions i
JOIN agents a ON i.agent_id = a.id
JOIN code_standards s ON i.standard_id = s.id
WHERE i.passed = false
GROUP BY a.id, s.id
ORDER BY failures DESC;
```

**Key learnings:**
- ✅ How to link multiple data types
- ✅ How to search across relationships
- ✅ How to find patterns in interactions

**Time to adapt:** 2-3 hours

**Advanced use:**
```
Agent Health Dashboard:
├─ dan-backend-engineer
│  ├─ Struggles with: JWT handling (60% failure)
│  ├─ Excels at: Validation (95% pass)
│  └─ Next focus: Reduce JWT failures
├─ coach-frontend-engineer
│  ├─ Struggles with: Accessibility (40% failure)
│  ├─ Excels at: Layout (98% pass)
│  └─ Next focus: Improve a11y
└─ Recommendations for next optimization
```

---

## 📚 Extension 6: Job Hunt Pipeline

### What It Teaches
- **State machines** (applied → interviewing → rejected → offered)
- **Workflows** (transitions with validation)
- **Pipeline visualization** (Kanban board)

### How It Maps to Agent Enhancement
```
Job Hunt Pipeline:
├─ Applied → Screened → Interviewed → Offered
├─ Status changes trigger actions
├─ Kanban view of pipeline
└─ Metrics: Conversion rates at each stage

Agent Optimization Pipeline:
├─ Baseline → Optimizing → Testing → Locked-in → Superseded
├─ Status changes trigger actions
├─ Kanban view of optimization progress
└─ Metrics: Success rate at each stage
```

### Your Adaptation for Optimization Workflow

```sql
-- Agent optimization state machine
CREATE TYPE optimization_status AS ENUM (
  'pending',     -- Identified, not started
  'in_progress', -- Currently testing
  'testing',     -- Waiting for test results
  'locked_in',   -- Confirmed improvement
  'reverted',    -- Failed, reverted
  'superseded'   -- Better optimization found
);

CREATE TABLE optimization_pipeline (
  id uuid primary key,
  agent_id uuid,
  pattern text,
  status optimization_status,
  status_changed_at timestamptz,
  improvement_percent int,
  
  -- Track transitions
  started_at timestamptz,
  locked_in_at timestamptz,
  
  created_at timestamptz
);

-- Trigger: When status changes, log event
CREATE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO optimization_events (optimization_id, from_status, to_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER optimization_status_change
BEFORE UPDATE ON optimization_pipeline
FOR EACH ROW
EXECUTE FUNCTION log_status_change();
```

**Pipeline visualization:**

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌──────────┐
│ Pending │ --> │ In Prog │ --> │ Testing │ --> │ Locked-in│
└─────────┘     └─────────┘     └─────────┘     └──────────┘
                                      │
                                      v
                                  ┌─────────┐
                                  │ Reverted│
                                  └─────────┘

This month's pipeline:
┌──────────────────────────────────────────┐
│ Pending (3 waiting)                      │
│ ├─ Pattern A                             │
│ ├─ Pattern B                             │
│ └─ Pattern C                             │
└──────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────┐
│ In Progress (1)                          │
│ ├─ Validation improvement (est +25%)     │
└──────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────┐
│ Testing (1)                              │
│ ├─ Error handling (waiting results)      │
└──────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────┐
│ Locked-in (2)                            │
│ ├─ Validation: +25%                      │
│ ├─ Error codes: +15%                     │
└──────────────────────────────────────────┘
```

**Key learnings:**
- ✅ How to model state machines in SQL
- ✅ How to trigger actions on status change
- ✅ How to visualize pipeline progress

**Time to adapt:** 3-4 hours

**Advanced use:**
```
Funnel Analysis:
├─ Optimizations attempted: 12
├─ Made it to testing: 10 (83%)
├─ Locked-in: 8 (80% of testing)
├─ Improvement average: 18%
├─ Total compound improvement: 144%
└─ Recommendation: Current approach works well

Metrics to track:
├─ Cycle time (idea → locked-in)
├─ Success rate (testing → locked-in)
├─ Average improvement (before → after)
├─ Cumulative improvement (sum of all)
└─ Revert rate (locked-in → reverted)
```

---

## 🛠️ Building Your Own Extension

All 6 extensions follow this pattern:

```
extension-name/
├─ README.md                (How to build it)
├─ metadata.json            (Requirements, dependencies)
├─ schema/
│  └─ tables.sql            (Database schema)
├─ implementation/
│  ├─ setup.js              (Initial setup)
│  └─ query.js              (Common queries)
├─ dashboard/
│  └─ index.tsx             (React dashboard)
└─ examples/
   └─ example-data.sql      (Sample data)
```

**If you want to build "Agent Enhancement Dashboard":**

```
agent-enhancement/
├─ README.md
│  └─ "Track agent optimization across projects"
├─ metadata.json
│  └─ Requires: Supabase, pgvector
├─ schema/
│  └─ Create tables for:
│     ├─ agents
│     ├─ optimizations
│     ├─ test_results
│     └─ patterns
├─ implementation/
│  └─ Common queries:
│     ├─ Best patterns
│     ├─ Agent trends
│     ├─ Improvement funnel
│     └─ Pattern dependencies
├─ dashboard/
│  └─ Visualizations:
│     ├─ Pass rate trend
│     ├─ Pipeline Kanban
│     ├─ Agent health
│     └─ Pattern dependency graph
└─ examples/
   └─ Load sample data
```

---

## 📊 Extension Learning Timeline

**Week 1: Household Knowledge Base**
- Goal: Understand basic schema + tagging
- Time: 2-3 hours
- Maps to: Storing agent patterns
- Next: You can store agent learnings in OB1

**Week 2: Home Maintenance Tracker**
- Goal: Add scheduling + status tracking
- Time: 2-3 hours (cumulative: 5-6 hours)
- Maps to: Tracking optimization cycles
- Next: You can track weekly optimization progress

**Week 3: Family Calendar**
- Goal: Understand RLS + multi-user
- Time: 3-4 hours (cumulative: 8-10 hours)
- Maps to: Multi-team agent work
- Next: You can share agents across teams safely

**Week 4: Meal Planning**
- Goal: Learn complex relationships + aggregations
- Time: 4-5 hours (cumulative: 12-15 hours)
- Maps to: Pattern dependencies + recommendations
- Next: You can recommend optimization paths

**Week 5: Professional CRM**
- Goal: Master many-to-many + full search
- Time: 5-6 hours (cumulative: 17-21 hours)
- Maps to: Agent interaction tracking
- Next: You have complete agent health dashboard

**Week 6: Job Hunt Pipeline**
- Goal: Build state machines + workflows
- Time: 6-8 hours (cumulative: 23-29 hours)
- Maps to: Optimization pipeline
- Next: You have complete agent optimization system

---

## ✅ Quick Extension Reference

| Extension | Core Skill | Agent Mapping | Time | Priority |
|-----------|-----------|---------------|------|----------|
| Household | Schema + metadata | Store patterns | 2-3h | High |
| Maintenance | Scheduling + status | Track cycles | 2-3h | High |
| Calendar | RLS + sharing | Multi-team | 3-4h | Medium |
| Meal Plan | Relationships + aggregations | Pattern graphs | 4-5h | Medium |
| CRM | Many-to-many + search | Agent tracking | 5-6h | Medium |
| Pipeline | State machines | Optimization flow | 6-8h | High |

---

## 🚀 Recommended Learning Order

**If you want core agent tracking:**
```
Week 1: Household Knowledge Base (store patterns)
Week 2: Home Maintenance Tracker (track cycles)
Week 3: Job Hunt Pipeline (optimize workflow)
→ Total: 10-11 hours
→ Result: Working agent optimization system
```

**If you want everything (full mastery):**
```
Follow the 6-week learning path (all extensions)
→ Total: 23-29 hours
→ Result: Expert-level understanding of OB1
```

**If you want to build for teams:**
```
Week 1: Household Knowledge Base
Week 2: Home Maintenance Tracker
Week 3: Family Calendar (add RLS)
Week 4: Job Hunt Pipeline (add workflow)
→ Total: 12-14 hours
→ Result: Multi-team agent optimization system
```

---

## 💾 How to Get Started

**Option 1: Watch OB1's Video Walkthrough**
```
Go to: vimeo.com/1174979042/f883f6489a
Watch: Full Open Brain setup (27 min)
Then: Follow Extension 1 in docs
```

**Option 2: Read & Build**
```
1. Read OB1/docs/01-getting-started.md (30 min)
2. Set up Supabase + pgvector (15 min)
3. Start with Extension 1 (2-3 hours)
```

**Option 3: AI-Assisted Build**
```
1. Go to OB1 folder
2. Open in Claude Code
3. Ask: "Help me build Extension 1 for agent tracking"
```

---

**Version:** 1.0  
**Status:** Ready to explore  
**Total learning time:** 2-29 hours (depending on depth)  
**Payoff:** Understanding OB1 + building custom extensions
