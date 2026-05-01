# Task 8: Query Performance Optimization

**Agent:** data-engineer

**Objective:** Optimize a slow query and demonstrate improvement with indexing strategy.

---

## Input Specification

**Current slow query:**
```sql
SELECT e.*, a.* FROM events e 
WHERE e.date > NOW() 
ORDER BY e.date ASC;
```

**Current performance:** Execution time ~500ms on 100k events

**Requirement:** Optimize this query to run in < 100ms. Explain the indexing strategy. Provide EXPLAIN output showing the improvement.

---

## Output Specification

Generate:
- ✅ Optimized SQL query (if improvements possible beyond indexes)
- ✅ CREATE INDEX statements needed
- ✅ EXPLAIN ANALYZE output (before optimization)
- ✅ EXPLAIN ANALYZE output (after optimization)
- ✅ Written explanation of optimization strategy
- ✅ Trade-offs documented (storage vs. speed, write performance impact)

---

## Success Criteria

- ✅ Query returns correct result set (future events ordered by date)
- ✅ EXPLAIN plan shows index usage (no full table scans)
- ✅ Execution time improved by 50%+ (target < 100ms from 500ms)
- ✅ Index design is sound (not over-indexing, multi-column indexes if beneficial)
- ✅ Documentation explains:
  - Which index was added and why
  - How query execution changed
  - Any trade-offs (write performance, storage)

---

## Notes

- Assume tables: events (id, date, other columns), attendees (id, event_id, ...)
- Consider composite indexes if multiple columns are filtered
- Document assumptions about data distribution
- Explain why full table scan was happening before (no index on date)
- Demonstrate EXPLAIN ANALYZE before/after with actual output
