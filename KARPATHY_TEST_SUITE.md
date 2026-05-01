---
title: Karpathy Auto-Improvement Test Suite
version: 1.0
date: 2026-04-30
system: Code Generation Agents (Backend, Frontend, Data Engineer)
---

# Karpathy Loop Test Suite Specification

## Overview

This document defines the **baseline test suite** for measuring code generation quality across your agent team. Each task is a concrete, repeatable benchmark that agents solve to generate a performance baseline — critical for auto-improvement loops where you measure whether prompt optimizations actually work.

**Purpose:** Lock in standard tasks so that cycle times are predictable and results are comparable.

**Target Cycle Time:** ~40–45 minutes per experiment (25–40 min task execution + 10–15 min Playwright E2E tests)

---

## Test Suite: 9 Archetypal Tasks

### BACKEND TASKS (Dan-Backend-Engineer / Joey-Fullstack-Backend)

---

#### **Task 1: REST API with Validation**

**Domain:** Backend

**Objective:** Generate a complete REST API endpoint with input validation, error handling, and proper HTTP semantics.

**Input Specification:**
```
Resource: User
Schema:
  - id: UUID (auto)
  - email: string (required, unique)
  - name: string (required, 1-100 chars)
  - created_at: timestamp (auto)

Requirement: "Build a POST /users endpoint that accepts email and name, validates both, returns 201 with the created user or 400 with validation errors."
```

**Output Specification:**
- Express.js/TypeScript handler
- Zod or Joi validation schema
- Proper HTTP status codes (201, 400, 409)
- Error response format with field-level details
- No hardcoded values; uses environment variables

**Success Criteria:**
- ✅ Code compiles without errors
- ✅ Passes 5 unit tests:
  1. Valid input → 201 with created user
  2. Missing email → 400 with error detail
  3. Invalid email format → 400 with error
  4. Duplicate email → 409 conflict
  5. Missing name → 400 with error
- ✅ Follows Code Standards from agent prompt (input validation, error handling, response format)
- ✅ No SQL injection risks or security flaws

**Measurement:**
- Test pass rate (0–100%)
- Code review: Does it match the agent's stated standards?

**Time Estimate:** 25–30 minutes

---

#### **Task 2: Database Query with Optimization**

**Domain:** Backend

**Objective:** Write an optimized SQL/ORM query with proper indexing strategy and performance considerations.

**Input Specification:**
```
Schema:
  - users (id, email, name, created_at)
  - orders (id, user_id, amount, created_at)
  - Relationship: orders.user_id → users.id

Requirement: "Fetch a single user with their last 10 orders, sorted by date descending. Optimize for performance and explain the indexing strategy."
```

**Output Specification:**
- SQL query (or ORM equivalent: Prisma/TypeORM)
- Comments explaining joins, filtering, sorting
- Indexing recommendations (which columns to index for this query)
- Performance notes (e.g., avoid N+1 queries)

**Success Criteria:**
- ✅ Query syntax is correct
- ✅ Returns correct result set (user + last 10 orders)
- ✅ Explain plan shows index usage (no full table scans)
- ✅ Execution time < 100ms on test data
- ✅ No N+1 query pattern (single query, not loop of queries)
- ✅ Indexing strategy is sound and documented

**Measurement:**
- Query correctness (binary: pass/fail)
- Execution time (< 100ms passes)
- Code quality (proper commenting, no antipatterns)

**Time Estimate:** 20–25 minutes

---

#### **Task 3: Authentication Flow (JWT)**

**Domain:** Backend

**Objective:** Implement a complete JWT-based login flow with secure password handling.

**Input Specification:**
```
Requirement: "Implement POST /login endpoint. Accept email + password. Return JWT token on success or 401 on failure. Store passwords hashed with bcrypt cost ≥ 12."

Expected behavior:
- Valid credentials → 200 with JWT token (expires in 1 hour)
- Wrong password → 401 Unauthorized
- User not found → 401 Unauthorized (don't leak user existence)
- Missing fields → 400 Bad Request
```

**Output Specification:**
- Login handler (Express/TypeScript)
- Password hashing logic (bcrypt with cost ≥ 12)
- JWT generation and signing
- Error handling for all cases
- Security considerations documented

**Success Criteria:**
- ✅ Code compiles
- ✅ Passes 6 unit tests:
  1. Valid credentials → 200 with token
  2. Wrong password → 401
  3. User not found → 401
  4. Missing email → 400
  5. Missing password → 400
  6. Token validates correctly when passed to another endpoint
- ✅ Passwords stored hashed (never plain text)
- ✅ JWT expires correctly
- ✅ No hardcoded secrets; uses environment variables

**Measurement:**
- Test pass rate (0–100%)
- Security checklist: hashing, no secret leaks, proper error messages

**Time Estimate:** 30–40 minutes

---

#### **Task 4: Data Processing Function**

**Domain:** Backend

**Objective:** Build a robust data transformation function that handles edge cases and validates output.

**Input Specification:**
```
Raw data (CSV/JSON):
[
  { "phone": "(555) 123-4567", "email": "john@example.com", "signup_date": "2026-01-15" },
  { "phone": "invalid", "email": "jane@example.com", "signup_date": "2026-01-16" },
  { "phone": "555-123-4567", "email": "john@example.com", "signup_date": "2026-01-15" }  // duplicate
]

Requirement: "Clean phone numbers (remove formatting), validate emails, deduplicate by email, return structured records with status flags."
```

**Output Specification:**
- Function that processes array of raw records
- Returns array of cleaned records with:
  - phone: normalized (digits only, e.g., "5551234567")
  - email: validated and lowercased
  - is_duplicate: boolean
  - is_valid: boolean
- Handles edge cases (null values, malformed data, duplicates)
- Completes in < 5 seconds on 1000 rows

**Success Criteria:**
- ✅ Code compiles
- ✅ Passes 4 integration tests:
  1. Valid record → cleaned correctly
  2. Invalid email → marked invalid
  3. Malformed phone → marked invalid
  4. Duplicate email → marked as duplicate
- ✅ Performance: 1000 rows processed in < 5 seconds
- ✅ No crashes on edge cases (null, empty string, extreme values)

**Measurement:**
- Test pass rate (0–100%)
- Performance: execution time on 1000 rows
- Code quality: error handling, edge cases covered

**Time Estimate:** 25–30 minutes

---

### FRONTEND TASKS (Coach-Frontend-Engineer / Yam-Fullstack-Frontend)

---

#### **Task 5: Dashboard Page**

**Domain:** Frontend

**Objective:** Build a responsive dashboard component with data visualization and user interaction.

**Input Specification:**
```
Data available:
- totalUsers: number
- recentSignups: [{ email, name, date }]
- signupTrend: [{ date, count }]

Requirement: "Build a dashboard showing:
1. Total user count (large prominent number)
2. Signup trend chart (last 30 days)
3. Recent signups table (last 5 users)
4. Fully responsive (mobile, tablet, desktop)
5. Accessible (WCAG AA compliant)"
```

**Output Specification:**
- React component (TypeScript)
- Layout: header + 3 sections (metric, chart, table)
- Responsive design (Tailwind CSS)
- Accessibility: semantic HTML, ARIA labels, keyboard navigation
- Data fetching: useEffect to load data
- Loading state with skeleton
- Error handling with retry

**Success Criteria:**
- ✅ Renders without errors
- ✅ Passes Playwright E2E tests:
  1. Page loads and displays total user count
  2. Chart renders with data
  3. Recent signups table shows 5 rows
  4. Responsive: mobile view stacks, desktop view columns
  5. Keyboard navigation works (Tab, Enter)
- ✅ WCAG AA accessibility score
- ✅ No console errors

**Measurement:**
- Playwright test pass rate (0–100%)
- Lighthouse accessibility score
- Visual regression (screenshot match against baseline)

**Time Estimate:** 35–45 minutes

---

#### **Task 6: Form Component with Validation**

**Domain:** Frontend

**Objective:** Build a user signup form with client-side validation and error display.

**Input Specification:**
```
Fields:
- email: string (required, must be valid email)
- password: string (required, min 8 chars)
- terms: checkbox (required, must be checked)

Requirement: "Build a signup form that validates on blur, displays field-level errors, shows success message on submit, accessible."
```

**Output Specification:**
- React form component (TypeScript)
- Input validation (email format, password length)
- Error messages displayed inline below fields
- Submit button disabled until form is valid
- On submit: show success message (no actual submit, mock API)
- Accessibility: labels, ARIA errors, keyboard navigation

**Success Criteria:**
- ✅ Renders without errors
- ✅ Passes Playwright E2E tests:
  1. Empty form → submit button disabled
  2. Invalid email → error message shown
  3. Short password → error message shown
  4. Unchecked terms → error message shown
  5. All valid → submit enabled, success message on click
- ✅ Keyboard navigation works (Tab, Enter to submit)
- ✅ Follows code standards (component structure, reusability)

**Measurement:**
- Playwright test pass rate (0–100%)
- Code quality: component structure, accessibility

**Time Estimate:** 20–25 minutes

---

### DATA ENGINEER TASKS (Data-Engineer)

---

#### **Task 7: Schema Design (Normalization)**

**Domain:** Data Engineer

**Objective:** Design a normalized relational schema for a given domain.

**Input Specification:**
```
Requirement: "Design a schema for an event management system:
- Events: event_id, name, date, organizer, capacity
- Attendees: attendee_id, name, email, event_id
- Tickets: ticket_id, attendee_id, event_id, price, status
- Ensure no redundancy, proper relationships, suitable indexes."
```

**Output Specification:**
- SQL CREATE TABLE statements
- Primary keys, foreign keys, constraints
- Indexes on frequently queried columns
- Normalization notes (3NF compliance)
- Comments explaining design decisions

**Success Criteria:**
- ✅ SQL syntax is correct
- ✅ Tables are normalized (no redundant data)
- ✅ Foreign keys prevent orphaned records
- ✅ Indexes placed on:
  - Primary keys
  - Foreign keys
  - Columns used in WHERE/JOIN
- ✅ Constraints enforce data integrity (NOT NULL, UNIQUE, CHECK)
- ✅ No obvious performance issues

**Measurement:**
- Design correctness (normalization, constraints)
- Index strategy: appropriate for typical queries
- Code quality: comments, clarity

**Time Estimate:** 20–25 minutes

---

#### **Task 8: Query Performance Optimization**

**Domain:** Data Engineer

**Objective:** Optimize a slow query and demonstrate improvement.

**Input Specification:**
```
Slow query:
SELECT e.*, a.* FROM events e 
WHERE e.date > NOW() 
ORDER BY e.date ASC;

Current performance: Execution time ~500ms on 100k events

Requirement: "Optimize this query to run in < 100ms. Explain the indexing strategy. Provide EXPLAIN output showing the improvement."
```

**Output Specification:**
- Optimized SQL query (if possible; may just be indexes)
- CREATE INDEX statements
- EXPLAIN ANALYZE output (before and after)
- Written explanation of optimization strategy

**Success Criteria:**
- ✅ Query returns correct result set
- ✅ EXPLAIN plan shows index usage (no full table scans)
- ✅ Execution time improved by 50%+ (target < 100ms)
- ✅ Index design is sound (not creating unnecessary indexes)
- ✅ Documentation explains the trade-offs

**Measurement:**
- Execution time (< 100ms passes)
- Query correctness (binary)
- Explain plan analysis (index usage)

**Time Estimate:** 25–30 minutes

---

#### **Task 9: Data Pipeline (ETL)**

**Domain:** Data Engineer

**Objective:** Build a data pipeline that extracts, transforms, and loads data robustly.

**Input Specification:**
```
Requirement: "Build a daily pipeline:
1. Fetch new events from an external API (mock: /api/events?since=<timestamp>)
2. Transform: normalize dates, validate fields, enrich with location data
3. Load into database (events table)
4. Handle failures gracefully (retries, idempotency)
5. Log execution (start, end, rows processed, errors)"
```

**Output Specification:**
- TypeScript/Python script
- Error handling: API failures, timeout, invalid data
- Idempotency: re-running doesn't create duplicates
- Logging: structured logs with execution details
- Comments explaining logic

**Success Criteria:**
- ✅ Code runs without crashing
- ✅ Passes integration tests:
  1. Fetches data from mock API
  2. Transforms records correctly
  3. Loads into database without errors
  4. Handles API timeout gracefully (logs error, continues)
  5. Re-running doesn't create duplicates
  6. All records logged with count
- ✅ Execution time < 5 minutes for 1000 records
- ✅ Logs are structured and readable

**Measurement:**
- Test pass rate (0–100%)
- Execution time (< 5 min)
- Log quality and completeness
- Idempotency verification

**Time Estimate:** 30–40 minutes

---

## Cycle Time Summary

| Task # | Task Name | Time | Domain |
|--------|-----------|------|--------|
| 1 | REST API + Validation | 25–30 min | Backend |
| 2 | Database Query | 20–25 min | Backend |
| 3 | Auth Flow | 30–40 min | Backend |
| 4 | Data Processing | 25–30 min | Backend |
| 5 | Dashboard | 35–45 min | Frontend |
| 6 | Form Component | 20–25 min | Frontend |
| 7 | Schema Design | 20–25 min | Data |
| 8 | Query Optimization | 25–30 min | Data |
| 9 | Data Pipeline | 30–40 min | Data |

**Average Task Execution:** ~27 minutes
**+ Playwright E2E Tests:** ~12 minutes
**Total Cycle Per Experiment:** ~40–45 minutes

---

## How to Use This Suite

### 1. **Baseline Run** (Before Optimization)
Run all 9 tasks with your current agents. Record:
- ✅ How many tasks passed (0–9)
- ✅ Average execution time
- ✅ Common failure patterns
- ✅ Code quality scores

Example baseline: "7/9 pass, 40 min avg, deployment success 75%"

### 2. **Optimize Agent Prompts**
Modify one agent's Code Standards, Implementation Methodology, or Tech Stack guidance in `.claude/agents/*.md`.

Example: "Add stricter input validation requirements to dan-backend-engineer.md"

### 3. **Test Run**
Run all 9 tasks again with the modified agent. Record same metrics.

### 4. **Measure Improvement**
Compare:
- Pass rate change (75% → 85%? ✅ improvement)
- Time change (40 min → 38 min? marginal)
- Quality change (fewer security issues? ✅ good)

### 5. **Decision**
- If improvement: **Keep the change** and iterate
- If no change: **Revert** and try different optimization
- If regression: **Revert** immediately

---

## Success Metrics

For each experiment, you're measuring:

1. **Pass Rate:** % of tasks that meet success criteria (target: 95%+)
2. **Execution Time:** Total time per cycle (target: < 45 min)
3. **Code Quality:** Adherence to code standards (manual review or automated linting)
4. **Deployment Success:** Does the generated code deploy without errors? (target: 95%+)

---

## Next Steps

1. ✅ **Save this spec** in version control
2. ⬜ **Build test harnesses** for each task (automation to run all 9 and report results)
3. ⬜ **Run baseline** with your current agents
4. ⬜ **Lock in results** as your benchmark
5. ⬜ **Start optimization loop** (modify prompt → test → measure → decide)

---

## Timeline

- **Week 1:** Create test harnesses, run baseline
- **Week 2+:** Begin optimization experiments (2–3 per week)
- **Expected ROI:** 10–15% improvement in code quality within 4 weeks

---

**Version:** 1.0
**Last Updated:** 2026-04-30
**Status:** Ready for Baseline Run
