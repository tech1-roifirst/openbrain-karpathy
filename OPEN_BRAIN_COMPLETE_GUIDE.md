# Open Brain Complete Guide
**Your Personal AI Memory System — Setup, Usage, and Mastery**

---

## 🧠 What is Open Brain?

**Open Brain is a persistent AI memory system** — one database that any AI tool can read from and write to.

Instead of starting fresh with each conversation, your AI tools (Claude, ChatGPT, Cursor, etc.) share the same persistent memory of you.

```
Without Open Brain:
Claude session 1:  Remember X? (No, this is a new conversation)
Claude session 2:  Remember Y? (No, this is a new conversation)
ChatGPT:           Remember Z? (No, I can't access Claude's data)

With Open Brain:
Claude session 1:  Store: "User prefers async/await"
Claude session 2:  Retrieve: "User prefers async/await" ✅
ChatGPT:           Retrieve: "User prefers async/await" ✅
Cursor:            Retrieve: "User prefers async/await" ✅

All AI tools share one brain.
```

---

## 🎯 Core Concepts

### 1. Thoughts Table
Your main storage. Each thought is:
```
{
  id: uuid,
  content: "text of your thought",
  embedding: [0.2, 0.1, ...],  // Vector for semantic search
  metadata: {                    // Searchable tags
    type: "learning",
    topic: "coding",
    confidence: "high",
    date: "2026-05-02"
  },
  created_at: timestamp
}
```

### 2. Vector Search
Find thoughts by meaning, not keywords:
```
Query: "What patterns improved validation?"
Results: 
├─ "Field-level errors +25%" (similarity: 0.92)
├─ "Input validation required +15%" (similarity: 0.88)
└─ "Error messages matter" (similarity: 0.81)

No keyword matching needed!
```

### 3. Metadata Filtering
Tag thoughts for easy organization:
```
Save with metadata:
{
  type: "pattern",
  domain: "backend",
  improvement: 25,
  locked_in: true
}

Query: "Show all backend patterns with >20% improvement"
→ Instant filtering + semantic search combined!
```

### 4. MCP Server
AI clients connect to Open Brain via MCP protocol:
```
Claude Code → MCP Server → Supabase → Vector DB
              (reads/writes thoughts)
              
ChatGPT → Same MCP → Same Supabase → Same Thoughts
          (reads/writes same thoughts)
```

---

## 🚀 Phase 1: Setup (45 minutes)

### Step 1: Create Supabase Project

**What is Supabase?**
- PostgreSQL database in the cloud
- Free tier: great for personal use
- pgvector extension: enables vector search

**Setup:**
```
1. Go to supabase.com
2. Sign up with GitHub (fastest)
3. Click "New Project"
4. Name: "open-brain" (or your choice)
5. Set strong database password (save it!)
6. Pick region closest to you
7. Wait 1-2 minutes for project to create
```

**Save these credentials:**
```
Project URL:      https://[project-ref].supabase.co
Project ref:      [project-ref]
Database password: [your-password]
```

### Step 2: Enable Vector Extension

**In Supabase dashboard:**
```
Left sidebar → Database → Extensions
Search: "vector"
Click: Toggle ON for pgvector
```

### Step 3: Create Thoughts Table

**In Supabase → SQL Editor → New Query, paste:**

```sql
CREATE TABLE thoughts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for vector similarity search
CREATE INDEX ON thoughts
  USING hnsw (embedding vector_cosine_ops);

-- Index for metadata filtering
CREATE INDEX ON thoughts USING gin (metadata);

-- Index for date range queries
CREATE INDEX ON thoughts (created_at DESC);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thoughts_updated_at
  BEFORE UPDATE ON thoughts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### Step 4: Create Search Function

**New Query, paste:**

```sql
CREATE OR REPLACE FUNCTION match_thoughts(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.content,
    t.metadata,
    1 - (t.embedding <=> query_embedding) as similarity,
    t.created_at
  FROM thoughts t
  WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
    AND (filter = '{}'::jsonb OR t.metadata @> filter)
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Step 5: Enable Row Level Security (RLS)

**New Query, paste:**

```sql
-- Enable RLS
ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;

-- For personal use: owner can do anything
CREATE POLICY "Users see own thoughts"
  ON thoughts
  FOR SELECT
  USING (auth.uid() = (metadata->>'user_id')::uuid);

CREATE POLICY "Users insert own thoughts"
  ON thoughts
  FOR INSERT
  WITH CHECK (auth.uid() = (metadata->>'user_id')::uuid);

-- For now, allow anonymous writes (you'll secure later)
CREATE POLICY "Anonymous can write"
  ON thoughts
  FOR INSERT
  WITH CHECK (true);
```

### Step 6: Get API Keys

**In Supabase Dashboard:**
```
Settings → API
Copy "anon public key"   → Save to .env as SUPABASE_ANON_KEY
Copy "service_role key" → Save to .env as SUPABASE_SERVICE_ROLE_KEY
```

### Step 7: Get Embedding API Key

**For creating vector embeddings, pick ONE:**

**Option A: OpenAI** (Most popular)
```
1. Go to openai.com
2. Create account or log in
3. API keys → Create new secret key
4. Save to .env as OPENAI_API_KEY
5. Cost: ~$0.02 per 1M tokens
```

**Option B: OpenRouter** (Recommended - cheaper)
```
1. Go to openrouter.ai
2. Sign up
3. Get API key
4. Save to .env as OPENROUTER_API_KEY
5. Cost: ~$0.005 per 1M tokens (4x cheaper!)
```

### Step 8: Create .env File

**In your project root:**

```bash
# .env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
# OR
OPENROUTER_API_KEY=your-openrouter-key
```

### Step 9: Test Connection

**Create test.js:**

```javascript
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function test() {
  // Test insert
  const { data, error } = await supabase
    .from("thoughts")
    .insert([
      {
        content: "Open Brain is working!",
        metadata: { test: true }
      }
    ])
    .select();

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("✅ Successfully saved thought:", data);
  }
}

test();
```

**Run:**
```bash
npm install @supabase/supabase-js
node test.js
```

**Expected output:**
```
✅ Successfully saved thought: [{ id: "uuid...", content: "...", ... }]
```

---

## 📝 Phase 2: Save Thoughts (Daily Usage)

### How to Save a Thought

```javascript
async function captureThought(content, metadata = {}) {
  const { data, error } = await supabase
    .from("thoughts")
    .insert([
      {
        content: content,
        metadata: {
          ...metadata,
          captured_at: new Date().toISOString()
        }
      }
    ])
    .select();

  return data?.[0] || null;
}

// Usage examples:

// Learning
await captureThought(
  "Claude prefers async/await over raw promises",
  { type: "learning", domain: "coding", confidence: "high" }
);

// Decision
await captureThought(
  "Decided to use TypeScript for all new projects",
  { type: "decision", impact: "high", date: "2026-05-02" }
);

// Pattern
await captureThought(
  "REST API validation with Zod + 400 field errors improves clarity",
  { type: "pattern", domain: "backend", effectiveness: 8.5 }
);

// Problem
await captureThought(
  "JWT token expiration logic still failing in task 3",
  { type: "problem", severity: "high", status: "open" }
);

// Reference
await captureThought(
  "Karpathy loop: Baseline → Optimize → Measure → Decide",
  { type: "reference", source: "agent-enhancement-system.md" }
);
```

### What to Save

**Types of thoughts to capture:**

```
1. LEARNINGS
   "Users respond better to Code Standards with examples"
   → Help you remember discoveries

2. DECISIONS
   "Always use field-level validation errors in REST APIs"
   → Lock in conclusions

3. PATTERNS
   "N+1 query prevention reduces execution time by 50%"
   → Codify best practices

4. PROBLEMS
   "JWT expiration not working in auth flow"
   → Track open issues

5. REFERENCES
   "OB1 vector search syntax: match_thoughts(embedding, threshold)"
   → Store useful code snippets

6. PEOPLE
   "Alice specializes in React optimization"
   → Remember who knows what

7. IDEAS
   "Build dashboard showing agent health trends"
   → Capture brainstorms

8. OBSERVATIONS
   "Dan-backend improved 50% when validation explicitly required"
   → Note what you observe
```

### Metadata Best Practices

**Good metadata:**
```javascript
{
  type: "learning",           // What type of thought?
  domain: "backend",          // What area?
  confidence: "high",         // How sure are you?
  improvement_percent: 25,    // Measurable impact?
  locked_in: true,            // Should this stay?
  date: "2026-05-02",         // When did this happen?
  related_to: ["validation"], // Links to other thoughts?
  tags: ["errors", "api"]     // Searchable tags?
}
```

**Avoid:**
```javascript
{
  note: "something",         // Too vague
  misc: true,                // Non-specific
  random_field: "xyz"        // Unhelpful
}
```

---

## 🔍 Phase 3: Search Thoughts (Retrieval)

### Semantic Search

```javascript
async function searchThoughts(query, metadata_filter = {}) {
  // 1. Convert query to vector (embedding)
  const embeddingResponse = await fetch(
    "https://api.openai.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: query,
        model: "text-embedding-3-small"
      })
    }
  );

  const embeddingData = await embeddingResponse.json();
  const queryEmbedding = embeddingData.data[0].embedding;

  // 2. Search in Supabase
  const { data } = await supabase.rpc("match_thoughts", {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 10,
    filter: metadata_filter
  });

  return data;
}

// Usage:

// Search 1: Find validation patterns
const results1 = await searchThoughts(
  "What improved validation error handling?"
);
// Returns: [
//   { content: "Field-level validation...", similarity: 0.92 },
//   { content: "Input validation rules...", similarity: 0.88 }
// ]

// Search 2: Find backend learnings from 2026
const results2 = await searchThoughts(
  "REST API best practices",
  { type: "learning", domain: "backend" }
);

// Search 3: Find high-confidence patterns
const results3 = await searchThoughts(
  "Performance optimization",
  { confidence: "high", improvement_percent: { $gte: 15 } }
);
```

### Query Examples

```javascript
// "What patterns unlocked the most improvement?"
await searchThoughts(
  "patterns that improved pass rate significantly"
);

// "Show me decisions about authentication"
await searchThoughts(
  "authentication and JWT handling",
  { type: "decision", domain: "backend" }
);

// "What did I learn about React performance?"
await searchThoughts(
  "React component optimization",
  { type: "learning", domain: "frontend" }
);

// "Find people who know about databases"
await searchThoughts(
  "SQL optimization and indexing",
  { type: "people" }
);

// "What problems are still open?"
await searchThoughts(
  "bugs and failures",
  { type: "problem", status: "open" }
);
```

---

## 🧠 Phase 4: Use Cases

### Use Case 1: Personal Learning System

```
Daily workflow:
├─ Read article/blog post
├─ Save key learnings: "Zod validation patterns..."
│  └─ metadata: { type: "learning", source: "blog", confidence: "medium" }
├─ Next week: Search "validation patterns"
│  └─ Open Brain surfaces that learning
└─ Build up knowledge over time
```

### Use Case 2: Project Knowledge Base

```
Project: Build payment processor
├─ Save: "Transaction idempotency crucial" (type: "learning")
├─ Save: "Use PostgreSQL transactions" (type: "decision")
├─ Save: "Handle race conditions with locks" (type: "pattern")
├─ Later: New developer joins
│  └─ Search: "What do we know about payment processing?"
│  └─ Open Brain shows all 3 thoughts
```

### Use Case 3: Team Knowledge Management

```
Team of 5 engineers
├─ Alice: Saves React learnings
├─ Bob: Saves backend patterns
├─ Carol: Saves DevOps decisions
├─ Dan: Saves database optimizations
├─ Eve: Saves security practices
│
Everyone searches:
├─ Alice: "What do we know about testing?"
│  → Finds Bob's learning + Eve's practice
├─ Bob: "Show React performance patterns"
│  → Finds Alice's learning
└─ Organization: All knowledge accessible
```

### Use Case 4: Agent Enhancement (Karpathy)

```
Week 1: Agent improvement
├─ Save: "Validation +25% improvement" (type: "pattern")
├─ metadata: { agent: "dan", locked_in: true }

Week 2: Search before optimizing
├─ Query: "What patterns worked for error handling?"
├─ OB1 returns: "Validation was successful"
├─ Apply to new agent

Week 3: New project
├─ Import patterns from Week 1
├─ Baseline starts higher
├─ Progress compounds
```

---

## 🎨 Phase 5: Advanced Features

### Multi-User Setup (Teams)

**Add user isolation with RLS:**

```sql
-- Update thoughts table to include user_id
ALTER TABLE thoughts ADD COLUMN user_id uuid;

-- Update RLS policy
CREATE POLICY "Users see only their thoughts"
  ON thoughts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Public shared thoughts
CREATE POLICY "See public thoughts"
  ON thoughts
  FOR SELECT
  USING (metadata->>'visibility' = 'public' OR user_id = auth.uid());
```

**Usage:**

```javascript
// Save as public (team accessible)
await captureThought(
  "Validation pattern for REST APIs",
  {
    type: "pattern",
    visibility: "public",  // Everyone can read
    author: "alice"
  }
);

// Save as private
await captureThought(
  "Personal career goals",
  {
    type: "decision",
    visibility: "private"  // Only me
  }
);
```

### Thought Collections (Organize by Project)

**Group related thoughts:**

```javascript
// Save with collection reference
await captureThought(
  "Field-level validation pattern",
  {
    type: "pattern",
    collection: "agent-enhancement-2026",
    domain: "backend"
  }
);

// Later: Get all thoughts in collection
const projectThoughts = await searchThoughts(
  "validation patterns",
  { collection: "agent-enhancement-2026" }
);
```

### Thought Relationships

**Link related thoughts:**

```javascript
// Thought 1: Problem
const problem = await captureThought(
  "JWT tokens not expiring properly",
  {
    type: "problem",
    id: "jwt-expiration-issue",
    status: "open"
  }
);

// Thought 2: Solution
const solution = await captureThought(
  "Add explicit expiration check in middleware",
  {
    type: "solution",
    related_to: ["jwt-expiration-issue"],
    resolves: "jwt-expiration-issue"
  }
);

// Later: Find problem and its solutions
const problems = await searchThoughts("JWT expiration issues");
// Returns both problem and solution
```

### Tagging System

**Use tags for cross-cutting concerns:**

```javascript
// Save with multiple tags
await captureThought(
  "Database indexing improves query speed",
  {
    type: "pattern",
    tags: ["performance", "database", "optimization"],
    domain: "backend"
  }
);

// Search by tag
const performanceThoughts = await searchThoughts(
  "speed and efficiency",
  { tags: { $contains: ["performance"] } }
);
```

---

## 🔌 Phase 6: Connect to AI Tools

### Claude Code Integration

**Create Claude MCP server:**

```javascript
// .claude/mcp-server/ob1-server.js
const { createClient } = require("@supabase/supabase-js");
const { openai } = require("openai");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Tool 1: Save thought
async function saveThought(content, metadata) {
  const { data, error } = await supabase
    .from("thoughts")
    .insert([{ content, metadata }]);
  return data?.[0];
}

// Tool 2: Search thoughts
async function searchThoughts(query, filter) {
  // ... embedding + search logic
}

// Export for MCP
module.exports = {
  tools: {
    save_thought: saveThought,
    search_thoughts: searchThoughts
  }
};
```

**Register in Claude Code:**

```json
{
  ".claude/mcp.json": {
    "mcpServers": {
      "open-brain": {
        "command": "node",
        "args": ["./.claude/mcp-server/ob1-server.js"]
      }
    }
  }
}
```

**Usage in Claude Code:**

```
You: "Remember that I prefer TypeScript"
Claude: @open-brain save_thought("User prefers TypeScript over JavaScript", { type: "learning", domain: "coding" })

You: "What have I learned about testing?"
Claude: @open-brain search_thoughts("testing practices", { type: "learning" })
```

### ChatGPT Custom GPT Integration

**Create as Custom GPT:**

```
1. ChatGPT → Create → New GPT
2. Name: "My Open Brain"
3. Instructions: Connect to Supabase Open Brain instance
4. Actions: Add OpenAI API calls to search/save
5. Use: "Remember X" and "Find X" in ChatGPT
```

### Cursor IDE Integration

```javascript
// In .cursor/rules.md
// When user asks about patterns or learnings,
// automatically search Open Brain:
// 1. Parse user question
// 2. Call: @ob1.search_thoughts(question)
// 3. Include results in context
// 4. Provide answer with OB1 knowledge
```

---

## 📊 Phase 7: Build on Open Brain (Extensions)

### Dashboard (See Your Thoughts)

```html
<!-- Simple dashboard -->
<div>
  <h1>My Open Brain</h1>
  
  <div>
    <input type="text" id="search" placeholder="Search thoughts...">
    <button onclick="search()">Search</button>
  </div>
  
  <div id="results">
    <!-- Results show here -->
  </div>
</div>

<script>
async function search() {
  const query = document.getElementById("search").value;
  const results = await fetch("/api/search", {
    method: "POST",
    body: JSON.stringify({ query })
  });
  // Display results
}
</script>
```

### Backup & Export

```javascript
async function backupThoughts() {
  const { data } = await supabase
    .from("thoughts")
    .select("*");
  
  // Save to file
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync("ob1-backup.json", json);
}
```

### Analytics

```javascript
async function analyzeThoughts() {
  const { data } = await supabase
    .from("thoughts")
    .select("metadata");
  
  const stats = {
    total: data.length,
    byType: data.reduce((acc, t) => {
      acc[t.metadata.type] = (acc[t.metadata.type] || 0) + 1;
      return acc;
    }, {}),
    byDomain: data.reduce((acc, t) => {
      acc[t.metadata.domain] = (acc[t.metadata.domain] || 0) + 1;
      return acc;
    }, {})
  };
  
  console.log("📊 Open Brain Analytics", stats);
}
```

---

## ✅ Complete Checklist

### Setup (45 min)
```
□ Create Supabase project
□ Enable pgvector
□ Create thoughts table
□ Create search function
□ Enable RLS
□ Get API keys
□ Create .env file
□ Test connection
```

### Daily Usage (5 min/day)
```
□ Save 1-3 thoughts daily
□ Use good metadata
□ Capture learnings
□ Note decisions
□ Record patterns
```

### Weekly Usage (10 min/week)
```
□ Search for relevant patterns
□ Review this week's thoughts
□ Export backup
□ Clean up duplicates
```

### Monthly Usage (30 min/month)
```
□ Analyze trends
□ Update relationships
□ Review effectiveness
□ Plan next month
```

---

## 🎯 Success Metrics

**After 1 month:**
```
□ 30+ thoughts captured
□ Can search and find patterns
□ Understand metadata tagging
□ Using in 1+ AI tool
```

**After 3 months:**
```
□ 100+ thoughts
□ Solved problems using OB1 searches
□ Team sharing knowledge
□ Custom dashboard working
```

**After 6 months:**
```
□ 300+ thoughts
□ OB1 is part of daily workflow
□ Knowledge compounds across projects
□ Team can't imagine working without it
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Supabase won't create project | Clear cookies, use incognito |
| pgvector not showing in extensions | Refresh page, wait for project to fully init |
| Can't insert thoughts | Check RLS policies, verify credentials |
| Search returns no results | Verify embedding API is working, check metadata |
| MCP server won't connect | Check .env variables, verify paths |
| Can't access from ChatGPT | Set up OAuth tokens, verify CORS |

---

## 📚 Related Resources

**OB1 Official:**
- GitHub: github.com/NateBJones-Projects/OB1
- Discord: discord.gg/Cgh9WJEkeG
- Video: vimeo.com/1174979042/f883f6489a

**Supabase:**
- Docs: supabase.com/docs
- pgvector: github.com/pgvector/pgvector

**For Karpathy Integration:**
- Read: OB1_INTEGRATION_GUIDE.md
- Read: OB1_RECIPES_GUIDE.md

---

## 🚀 Next Steps

**Week 1:**
```
1. Complete Phase 1: Setup (45 min)
2. Complete Phase 2: Save your first 5 thoughts
3. Complete Phase 3: Try searching
```

**Week 2:**
```
1. Start Phase 4: Use cases
2. Save daily (5 thoughts/day)
3. Search for patterns (2-3 times)
```

**Week 3:**
```
1. Complete Phase 5: Advanced features
2. Set up tagging system
3. Create thought relationships
```

**Week 4:**
```
1. Complete Phase 6: Connect to AI tools
2. Use OB1 in Claude Code
3. Use OB1 in ChatGPT
```

**Month 2:**
```
1. Complete Phase 7: Build extensions
2. Create simple dashboard
3. Set up backups
4. Analyze your thoughts
```

---

## 💡 Pro Tips

**1. Save often, organize later**
```
Just capture thoughts freely.
Good metadata comes with practice.
Better to have 100 thoughts with messy metadata
than 10 perfect thoughts.
```

**2. Link everything**
```
When saving a new thought, check if it relates
to previous thoughts. Add relationships.
Open Brain becomes more powerful as connections grow.
```

**3. Review regularly**
```
Weekly: Read your thoughts from last week
Monthly: Analyze trends
Quarterly: Export and backup
```

**4. Use in decisions**
```
Before making a decision, search Open Brain:
"What have I learned about this?"
Let past knowledge inform future choices.
```

**5. Share with team**
```
Make useful patterns public (visibility: "public").
Let team benefit from your learning.
Compound knowledge across the whole team.
```

---

**Version:** 1.0  
**Status:** ✅ Complete and ready  
**Setup time:** 45 minutes  
**Ongoing:** 5 min/day to capture, 10 min/week to search  
**Payoff:** Persistent memory that compounds over time  

🧠 **Welcome to Open Brain. Your AI now remembers you.**
