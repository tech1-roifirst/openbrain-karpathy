# OB1 Integration Guide
**How to Use Open Brain Patterns in Your Agent Enhancement System**

---

## Overview

This guide shows you how to integrate **OB1's memory & knowledge architecture** into your **Karpathy agent improvement loop**. Instead of storing agent learnings as scattered markdown files, you'll use OB1's vector database system for smarter retrieval and cross-project knowledge reuse.

---

## 🎯 Integration Goals

### Before Integration
```
Agent Optimization Cycle:
├─ Week 1: Baseline (pass rate: 66%)
├─ Week 2: Optimize agent
├─ Week 3: Measure improvement
├─ Week 4: Update memory/MEMORY.md (text file)
│
Problem: 
└─ Text files don't scale
   └─ Hard to search across projects
   └─ No semantic understanding
   └─ Manual organization
```

### After Integration
```
Agent Optimization Cycle (Enhanced):
├─ Week 1: Baseline (pass rate: 66%)
├─ Week 2: Optimize agent
│  └─ Query OB1: "What validation patterns worked?"
│  └─ Get: Relevant learnings from past projects
├─ Week 3: Measure improvement
│  └─ Capture result to OB1 (semantic vector + metadata)
├─ Week 4: Update memory
│  └─ OB1 automatically indexes & relates knowledge
│
Benefit:
└─ Vector search across all projects
   └─ Semantic understanding ("What worked for validation?")
   └─ Automatic knowledge surfacing
   └─ Cross-project pattern discovery
```

---

## 🔗 Architecture: How OB1 Fits In

```
┌─────────────────────────────────────────────────────┐
│         Your Karpathy Agent Loop                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Monday: Review baseline                           │
│          └─ Query OB1 for similar past patterns    │
│                   ↓                                 │
│  Tue-Wed: Modify agent                             │
│          └─ Use patterns from OB1                  │
│                   ↓                                 │
│  Thu: Re-test                                       │
│       └─ Measure improvement                        │
│                   ↓                                 │
│  Fri: Lock in + Capture to OB1                     │
│       ├─ Save: "Validation improvement +25%"       │
│       ├─ Metadata: { agent: dan, pattern: field_errors }
│       └─ Vector: [semantic embedding]              │
│                   ↓                                 │
│                  OB1                                │
│       ┌─────────────────────────────────────────┐  │
│       │ Thoughts Table (Vector + Metadata)      │  │
│       ├─────────────────────────────────────────┤  │
│       │ id     | content | embedding | metadata │  │
│       │───────────────────────────────────────  │  │
│       │ uuid-1 | "Valid..." | [0.2, ...] | {..} │  │
│       │ uuid-2 | "Error..." | [0.3, ...] | {..} │  │
│       │ uuid-3 | "JWT..." | [0.4, ...] | {..} │  │
│       └─────────────────────────────────────────┘  │
│                   ↓                                 │
│       Next Project Baseline                        │
│       ├─ Query: "show validation patterns"         │
│       ├─ OB1 returns: [relevant past learnings]    │
│       └─ Start with 80% instead of 67%!            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📋 Step 1: Set Up OB1 (45 minutes)

You need to run OB1 once to have a persistent database for your learnings.

### 1.1: Create Supabase Project

```
1. Go to supabase.com → Sign up (GitHub is fastest)
2. Click "New Project"
3. Name: "agent-enhancement-brain"
4. Generate & save database password
5. Create project (wait 1-2 min)
6. Save Project ref from URL
```

**Credential Tracker:**
```
Supabase Project ref:      [your-project-ref]
Database password:         [your-password]
Supabase URL:             https://[project-ref].supabase.co
```

### 1.2: Set Up Database Tables

In Supabase SQL Editor, run these SQL commands:

**1. Enable pgvector:**
```
Go to: Database → Extensions → Search "vector" → Enable
```

**2. Create thoughts table:**
```sql
create table thoughts (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on thoughts using hnsw (embedding vector_cosine_ops);
create index on thoughts using gin (metadata);
create index on thoughts (created_at desc);
```

**3. Create search function:**
```sql
create or replace function match_thoughts(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10,
  filter jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    t.id,
    t.content,
    t.metadata,
    1 - (t.embedding <=> query_embedding) as similarity
  from thoughts t
  where 1 - (t.embedding <=> query_embedding) > match_threshold
    and (filter = '{}'::jsonb or t.metadata @> filter)
  order by t.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

### 1.3: Get API Keys

**Supabase:**
- In dashboard: Settings → API → Copy "anon public key" and "service_role key"
- Copy both to credential tracker

**OpenAI (for embeddings):**
- Go to openai.com → Get API key
- Or use OB1's recommended OpenRouter (cheaper, covers multiple models)

**Credential Tracker:**
```
Supabase Anon Key:         [key]
Supabase Service Role Key: [key]
OpenAI/OpenRouter API Key: [key]
```

---

## 🧠 Step 2: Create OB1 MCP Server (Optional but Recommended)

This gives you a Claude integration to save/search thoughts directly.

### 2.1: Deploy Edge Function (Supabase)

```
1. In Supabase: Functions → Create new function
2. Name: "vector-search"
3. Paste this code:
```

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openaiKey = Deno.env.get("OPENAI_API_KEY");

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === "POST") {
    const { query, limit = 10 } = await req.json();

    // Get embedding for query
    const embeddingRes = await fetch(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: query,
          model: "text-embedding-3-small",
        }),
      }
    );

    const embeddingData = await embeddingRes.json();
    const embedding = embeddingData.data[0].embedding;

    // Search in Supabase
    const { data } = await supabase.rpc("match_thoughts", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit,
    });

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("OK");
});
```

### 2.2: Register as MCP Server (Claude Code)

Create `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "ob1-vector-search": {
      "command": "node",
      "args": ["./.claude/mcp-server/ob1-server.js"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_KEY": "your-supabase-key",
        "OPENAI_API_KEY": "your-openai-key"
      }
    }
  }
}
```

---

## 🚀 Step 3: Integration Workflow

### 3.1: Before You Optimize (Query OB1)

**Monday morning, before modifying agent:**

```bash
# Ask Claude Code:
@ob1-vector-search What validation patterns improved pass rate?
@ob1-vector-search Show me successful error handling changes
@ob1-vector-search Which agents improved the most?
```

**Result:** Get relevant learnings from past projects

### 3.2: During Optimization (Update Agent)

Apply patterns from OB1 results to agent prompt:

```markdown
# dan-backend-engineer.md

## Code Standards

### Input Validation
**Pattern (from OB1): Field-level validation**
- Return { field: "error message" } for 400s
- Adoption in past 3 projects: +25% improvement
- Recommendation: Always use this pattern
```

### 3.3: After Optimization (Capture to OB1)

**Friday, after measuring improvement:**

```bash
# Save result to OB1
/learn Agent {dan-backend-engineer}: Validation requirement improved pass rate 50% → 75% (+25%). Pattern: field-level errors in 400 responses. This pattern should be permanently adopted for all backend agents.

Metadata:
- project: FULLSOURCE_ETG
- agent: dan-backend-engineer
- pattern: field-level-validation
- improvement: 25%
- confidence: high
- date: 2026-05-02
```

**OB1 will:**
1. Embed the text into vector space
2. Store metadata for filtering
3. Index it for future search
4. Make it available to future projects

### 3.4: In Next Project (Reuse Knowledge)

```bash
# New project baseline is 80% instead of 67%!
# Why? OB1 returned proven patterns

1. Query OB1: "What made validation improve?"
   └─ Returns: Field-level errors pattern (+25%)

2. Apply to new agent before baseline:
   └─ New dan-backend-engineer.md includes this pattern

3. New baseline: 80% (vs 67% without OB1 knowledge)

4. Now you only need to improve 20%
   └─ Faster path to 95%
```

---

## 📊 Integration Data Flow

```
PROJECT 1: FULLSOURCE_ETG
├─ Week 1: Baseline 66%
├─ Week 2: Validation fix → 77%
│  └─ Save to OB1: "field-level errors +25%"
├─ Week 3: Error handling → 85%
│  └─ Save to OB1: "specific error codes +8%"
└─ Week 4: Query performance → 90%
   └─ Save to OB1: "N+1 prevention +5%"

        OB1 Vector Database
        ├─ field-level errors (embedding, metadata)
        ├─ specific error codes (embedding, metadata)
        └─ N+1 prevention (embedding, metadata)

PROJECT 2: NEW_PROJECT
├─ Before baseline: Query OB1
│  └─ Results: Top 3 patterns from P1
├─ Apply patterns to agents
│  └─ New baseline: 80% (vs 67%)
├─ Only optimize remaining 20%
│  └─ Improvements compound
└─ Save new learnings to OB1
   └─ OB1 now has 6+ patterns

PROJECT 3+: Even faster
├─ OB1 has 10+ proven patterns
├─ New baseline: 85%
├─ Only optimize remaining 15%
└─ Spiral of compounding improvement
```

---

## 📝 Example: Save Agent Learning to OB1

**After Week 2 optimization locked in:**

```markdown
---
type: agent_learning
project: FULLSOURCE_ETG
agent: dan-backend-engineer
pattern: field-level-validation
date: 2026-05-02
---

# Field-Level Validation Error Pattern

## What Changed
Modified dan-backend-engineer Code Standards:
```markdown
### Input Validation
ALL endpoints MUST return 400 with:
{ field: "error message", field2: "error message" }

Examples:
- { email: "Invalid format" }
- { password: "Min 8 chars", email: "Already exists" }
```

## Results
- Before: 2/4 tasks pass (50%)
- After: 3/4 tasks pass (75%)
- Improvement: +25%

## Why It Worked
Agents weren't thinking about structured error responses until 
explicitly required. Field-level format makes client-side 
error display trivial.

## Confidence Level
HIGH — Confirmed across 3 backend tasks (1, 2, 4)

## Recommendation
PERMANENT — Lock this into all backend agent prompts

## Metadata
- improvement_percentage: 25
- applies_to: [dan-backend, joey-fullstack]
- related_patterns: [error-handling, validation]
- next_pattern_to_try: specific-error-codes
```

When saved to OB1:
1. Text gets embedded (vector)
2. Metadata indexed for filtering
3. Future projects can find via search
4. Can query: "Show validation improvements"
   - Returns this learning + similar ones

---

## 🔄 Monthly Workflow with OB1

```
WEEK 1: Baseline
├─ Generate 9 tasks
├─ Run karpathy:run-all
└─ Query OB1 for known patterns
   └─ "What patterns helped previous baselines?"

WEEK 2: First Optimization
├─ Review OB1 recommendations
├─ Modify agent based on proven patterns
├─ Re-test
└─ Capture result to OB1

WEEK 3: Second Optimization
├─ Query OB1: "What failed before?"
│  └─ Avoid past mistakes
├─ Try new pattern
├─ Re-test
└─ Capture (success or failure) to OB1

WEEK 4: Consolidation
├─ Review all learnings in OB1
├─ Update agent prompts permanently
├─ Export patterns for next project
└─ Save summary to OB1

NEXT PROJECT: Use Compounded Knowledge
├─ Query OB1: Top 5 patterns
├─ Apply all to new agents
├─ Baseline is 80%+ (vs 67%)
└─ Reach 95% faster
```

---

## 💾 Required Credentials

| Service | What | Where to Get |
|---------|------|-------------|
| Supabase | Project ref, API keys | supabase.com |
| OpenAI | API key (for embeddings) | openai.com |
| OR OpenRouter | API key (cheaper alternative) | openrouter.ai |

**Save all to:**
- `.env.local` (local development)
- `.claude/settings.local.json` (Claude Code)
- GitHub Secrets (CI/CD)

---

## ✅ Integration Checklist

```
SETUP (One-time, 45 min):
□ Create Supabase project
□ Run SQL table creation
□ Get API keys
□ Save to .env

OPTIONAL (30 min):
□ Deploy OB1 Edge Function
□ Register as MCP server
□ Test vector search

WORKFLOW (Every Monday):
□ Query OB1 before optimizing
□ Document improvements in OB1 format
□ Update agent based on proven patterns
□ Save learnings to OB1

COMPOUNDING (Next project):
□ Import top patterns from OB1
□ Baseline starts higher
□ Improvements compound
```

---

## 🎯 Success Metrics

**Before OB1 Integration:**
```
Project 1: 66% → 90% = +24% (4 weeks)
Project 2: 67% → 85% = +18% (4 weeks)  [No carryover]
Project 3: 66% → 82% = +16% (4 weeks)  [No carryover]
```

**After OB1 Integration:**
```
Project 1: 66% → 90% = +24% (4 weeks)   [Same as before]
                   ↓ Saved to OB1
Project 2: 80% → 95% = +15% (4 weeks)   [Better baseline!]
                   ↓ Saved to OB1
Project 3: 85% → 98% = +13% (4 weeks)   [Even better!]
                   ↓ Saved to OB1
```

**Benefit:**
- Project 1: +24%
- Project 2: +15% (but started 14% higher)
- Project 3: +13% (but started 19% higher)
- **Baseline improvement compounds over projects**

---

## 🚀 Next Steps

1. **This week**: Set up Supabase + OB1 core
2. **Next week**: Run Karpathy baseline, query OB1 for patterns
3. **Week 3**: First optimization, capture to OB1
4. **Week 4+**: Compound learnings across projects

---

**Version:** 1.0  
**Status:** Ready to implement  
**Setup time:** 45 minutes  
**Ongoing effort:** +10 minutes per week for OB1 updates  
**Payoff:** 10-20% better baselines in future projects
