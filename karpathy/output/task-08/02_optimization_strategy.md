# Task 08 / Deliverable 2: Optimization Strategy

## 1. Problem Statement

The query

```sql
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
ORDER  BY e.date ASC;
```

executes in ~500 ms against a 100,000-row `events` table. The brief targets
`< 100 ms` (>= 5x speedup) without changing the result set or its order.

## 2. Plan-Level Diagnosis

From `01_original_query.sql`, the EXPLAIN plan shows two compounding costs:

| Node | Cost contribution | Root cause |
|---|---|---|
| `Seq Scan on events` | ~70-100 ms | No index on `date`; the planner must read every heap page and discard 30% of rows. |
| `Sort` (external merge, disk spill) | ~350-400 ms | Heap rows are not in date order, so 70,000 rows must be sorted; the result exceeds `work_mem=4MB` and spills to temp files. |

Total: ~500 ms, dominated by the disk-spill sort.

## 3. Root Cause

Both nodes share a single root cause: there is no B-tree index on
`events.date`. A B-tree index, by definition, stores its leaf entries in
key order, so it simultaneously:

1. Eliminates the Seq Scan (we can range-scan `date > NOW()` directly).
2. Eliminates the Sort node (the index already returns rows in `date ASC`).

This is the textbook case where a single index removes two plan nodes.

## 4. Candidate Strategies (and which we rejected)

### A. Plain B-tree on `date` -- non-partial

```sql
CREATE INDEX idx_events_date ON events (date ASC);
```

- Pros: trivial; helps every query that filters or orders by `date`,
  including queries for past events (analytics, reporting).
- Cons: indexes 100% of rows -- ~30% of which (past events) we suspect
  are rarely queried in this workload.

### B. Partial B-tree on `date` -- only future events  (CHOSEN)

```sql
CREATE INDEX idx_events_future_dates
    ON events (date ASC)
    WHERE date > NOW();
```

- Pros: index contains only ~70% of rows; smaller, hotter, faster.
- Cons:
  - `WHERE date > NOW()` is a NON-IMMUTABLE predicate. PostgreSQL allows
    it, but `NOW()` is evaluated when the index is BUILT, not on every
    query. The "future" boundary therefore drifts: rows that were future
    at build time become past, and the index will retain them. To keep
    the index lean you must REINDEX (or drop and recreate) on a
    schedule. This is the standard trade-off for a "rolling window"
    partial index and is acceptable when the window is large
    (years, not hours).
  - Does not help queries for past events (they will still seq-scan or
    need a different index).

### C. Composite index `(date ASC, status)`

```sql
CREATE INDEX idx_events_date_status ON events (date ASC, status);
```

- Useful only if queries commonly add `AND status = 'active'`. The
  prompt's primary query does not filter by status, so this is overkill
  for the listed workload. Recommended as an additional index ONLY if
  the `status`-filtered variant in `07_test_queries.sql` becomes a hot
  path.

### D. Covering index with `INCLUDE`

```sql
CREATE INDEX idx_events_date_covering
    ON events (date ASC)
    INCLUDE (id, status, name, organizer);
```

- Allows an Index-Only Scan, avoiding heap fetches.
- Rejected as the default because `SELECT *` includes every column;
  the INCLUDE list ends up duplicating the table. We document this in
  `06_advanced_options.md` as a targeted optimization for narrow
  projections (e.g., `SELECT id, date FROM events WHERE ...`).

### E. Table partitioning by date range

- Overkill for 100,000 rows. Recommended at 10M+ rows or when retention
  policies require dropping old partitions cheaply. Documented in
  `06_advanced_options.md`.

## 5. Chosen Strategy

**Primary:** partial B-tree index `idx_events_future_dates`.

**Fallback / belt-and-braces:** if the workload mixes future and past
queries roughly evenly, switch to the non-partial `idx_events_date`.
Both DDL statements are present in `03_create_indexes.sql`; we recommend
deploying the partial index first and only adding the full index if
monitoring (file 08) shows past-event queries are also hot.

## 6. Expected Performance

| Metric | Before | After (expected) | Source |
|---|---|---|---|
| Execution time | ~500 ms | 8-25 ms | Index Scan + no Sort |
| Rows scanned | 100,000 | ~70,000 (index entries) | range scan |
| Plan shape | Seq Scan + Sort (disk spill) | Index Scan only | B-tree returns ordered |
| Speedup | -- | 20-60x | well above the 5x target |
| Heap fetches | 100,000 pages | ~2,000 pages (only matching rows) | Index Scan touches matched heap tuples |

## 7. Trade-offs

### Storage

- A B-tree index entry on a `TIMESTAMPTZ` column is ~24 bytes (8-byte
  key + 6-byte TID + page overhead). At 70,000 entries the partial
  index is ~1.5-3 MB on disk -- negligible. The full-table variant is
  ~2-4 MB.
- Both are well under the 50 MB target in the brief.

### Write performance

- `INSERT` / `UPDATE` / `DELETE` on `events` must now also update the
  index. Empirical overhead on a B-tree of this size: ~0.1-0.3 ms per
  row written. The brief's "+0.2-0.5 ms" budget is comfortably met.
- The partial index has the additional benefit that writes for past
  events (`date <= NOW()`) skip the index entirely (because the row
  doesn't satisfy the predicate). For an INSERT-heavy historical-import
  workload this is a meaningful win.

### Query coverage

- Helps: `WHERE date > NOW()`, `WHERE date BETWEEN NOW() AND ...`,
  `ORDER BY date ASC LIMIT n` for future events.
- Does not help (without further indexes): `WHERE date < NOW()`
  (past events), `WHERE status = 'x'` (no leading column),
  `WHERE organizer = 'x'`.

### Maintenance

- Partial index requires periodic REINDEX (e.g., monthly) to discard
  entries that have rolled past `NOW()`. See `08_monitoring.md`.
- Standard `autovacuum` settings are sufficient; no special tuning
  required at 100k rows.

## 8. Why this is the optimal choice for the stated workload

1. The query filters on `date > NOW()`  -> partial predicate aligns 1:1.
2. The query orders by `date ASC`       -> B-tree returns sorted output.
3. Selectivity is ~70%                  -> a full B-tree still wins
   because removing the sort matters more than the scan; a PARTIAL
   B-tree wins by an additional ~30% on size and write cost.
4. Storage and write-latency budgets are met by an order of magnitude.
5. The index is reversible (DROP INDEX is instant in terms of
   correctness; the only cost is rebuilding it).
