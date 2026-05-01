# Task 2: Database Query with Optimization

**Agent:** dan-backend-engineer

**Objective:** Write an optimized SQL/ORM query with proper indexing strategy and performance considerations.

---

## Input Specification

**Schema:**
```
- users (id UUID, email string, name string, created_at timestamp)
- orders (id UUID, user_id UUID, amount decimal, created_at timestamp)
- Relationship: orders.user_id → users.id (foreign key)
```

**Requirement:** Fetch a single user with their last 10 orders, sorted by date descending. Optimize for performance and explain the indexing strategy.

---

## Output Specification

Generate a SQL or ORM query (Prisma/TypeORM) that includes:
- ✅ Correct JOIN syntax between users and orders tables
- ✅ Filtering by user_id
- ✅ Sorting by created_at DESC
- ✅ Limit to 10 rows
- ✅ Comments explaining the query logic
- ✅ Indexing recommendations (which columns to index)
- ✅ Notes on avoiding N+1 query patterns

**Expected output:** SQL query file or ORM code file with inline documentation

---

## Success Criteria

The generated query should:
- ✅ Return correct result set (user + their 10 most recent orders)
- ✅ Have correct SQL syntax (no parse errors)
- ✅ Use indexes effectively (EXPLAIN plan shows index usage, no full table scans)
- ✅ Execute in < 100ms on test data
- ✅ Avoid N+1 query pattern (single query, not nested loops)
- ✅ Indexing strategy is sound and documented

---

## Notes

- Assume tables already exist with primary keys
- Write for PostgreSQL (or specify if different database)
- Include EXPLAIN ANALYZE output demonstrating performance
- Document the indexing strategy in comments
