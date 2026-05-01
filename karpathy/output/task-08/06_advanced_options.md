# Task 08 / Deliverable 6: Advanced Optimizations

The partial B-tree index alone gets us from 500 ms to ~19 ms. This file
catalogs further options that may be appropriate at larger scales or
for specific access patterns. Each option is rated by cost vs. benefit
and the trigger condition for adopting it.

## 1. Covering index (Index-Only Scan)

**What.** Add `INCLUDE` columns so the index carries every column the
query projects. The planner can then satisfy the entire query from
the index, with no heap visits.

```sql
CREATE INDEX CONCURRENTLY idx_events_upcoming_covering
    ON events (date ASC)
    INCLUDE (id, name, status, organizer)
    WHERE date > NOW();
```

**Benefit.** Eliminates the ~2,300 heap-page hits currently in the
optimized plan. For narrow projections this can shave another 30-60%
off the execution time and dramatically reduce buffer-pool pressure
on the heap.

**Cost.** The index becomes much larger (essentially a duplicate of
the table for the included columns). Visibility-map maintenance and
HOT-update friendliness are tighter -- if rows are frequently updated,
Index-Only Scans degrade to Index Scans because the visibility map
isn't kept fresh.

**When to use.**
- Stable, frequently-read columns.
- Narrow, KNOWN projection (`SELECT id, date, name ...`), not `SELECT *`.
- Read:write ratio strongly favors reads.

**When to avoid.** `SELECT *` workloads, frequently-updated rows, when
storage is constrained.

## 2. Composite index for multi-column filters

**What.** When queries add `AND status = 'x'` consistently, lead the
index with the range column (`date`) and follow with the equality
column (`status`).

```sql
CREATE INDEX CONCURRENTLY idx_events_date_status
    ON events (date ASC, status)
    WHERE date > NOW();
```

**Why date first?** B-tree composite indexes can do an in-descent
range scan only on the leading column. After a non-equality predicate
the trailing columns are useful only as in-index filters (saving heap
visits) -- not for narrowing the scan range.

**Cost.** Slightly larger index; one-shot cost on writes.

**Trigger.** EXPLAIN of a status-filtered query shows `Filter:
(status = 'active')` AND that filter discards a meaningful share of
rows.

## 3. Table partitioning by date range

**What.** Convert `events` to a declaratively partitioned table:

```sql
CREATE TABLE events (
    id   UUID,
    date TIMESTAMPTZ NOT NULL,
    ...
) PARTITION BY RANGE (date);

CREATE TABLE events_2026 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
-- one partition per year (or quarter, or month, depending on volume)
```

**Benefit.** Partition pruning -- the planner can skip whole
partitions whose range doesn't satisfy `date > NOW()`. Cheap retention:
`DROP TABLE events_2024` is instant, no `DELETE` storm. Smaller
per-partition indexes, often better cache locality.

**Cost.** Significant migration work; foreign keys to partitioned
tables have caveats; cross-partition unique constraints require a
column to be part of the partition key.

**Trigger.** Table grows past ~10M rows OR retention requires
purging old data efficiently. Strongly NOT recommended at 100k rows.

## 4. Materialized views for reporting

**What.** Pre-compute expensive aggregates and refresh on a schedule.

```sql
CREATE MATERIALIZED VIEW upcoming_events_by_organizer AS
SELECT  organizer,
        COUNT(*)               AS upcoming_count,
        MIN(date)              AS next_event_date
FROM    events
WHERE   date > NOW()
GROUP BY organizer;

CREATE UNIQUE INDEX ON upcoming_events_by_organizer (organizer);

-- refresh every 15 minutes from a cron job:
REFRESH MATERIALIZED VIEW CONCURRENTLY upcoming_events_by_organizer;
```

**Benefit.** Read latency drops to a single index lookup against the
materialized result, regardless of base-table size.

**Cost.** Stale-data window equal to the refresh interval; refresh
cost grows with base-table size; `CONCURRENTLY` requires a unique
index on the view.

**Trigger.** Repeated identical aggregate queries that don't need
real-time freshness (analytics dashboards, daily reports).

## 5. Read replicas for scaling reads

**What.** Hot-standby replicas serve read-only queries; the primary
handles writes.

**Benefit.** Linear read scalability; isolates heavy reporting
queries from the OLTP path.

**Cost.** Operational complexity (replication lag, failover, routing
logic in the application); doubled storage; eventual consistency.

**Trigger.** Single-primary read load saturates CPU/IO before scaling
vertically is feasible. Not yet relevant at the data sizes in this
brief.

## 6. PARTIAL index drift -- rebuild strategy

The chosen `WHERE date > NOW()` partial index has a known maintenance
cost: as time passes, "future" entries become "past" entries and stay
in the index. The query plan still works (the planner only proves
`date > runtime_now() >= build_time_now()`), but the index grows
larger than necessary.

```sql
-- Rebuild the index with a fresh NOW() boundary; safe to run
-- concurrently with reads/writes.
REINDEX INDEX CONCURRENTLY idx_events_future_dates;
```

`REINDEX CONCURRENTLY` re-evaluates `NOW()` at the start of the
rebuild, so the new index excludes rows whose `date` has fallen into
the past. Schedule this monthly (or weekly for high-churn workloads).
See `08_monitoring.md` for a size-based trigger.

## 7. BRIN index (Block Range INdex) for very wide tables

**What.** A BRIN index records min/max values per block range
rather than per row.

```sql
CREATE INDEX idx_events_date_brin ON events USING BRIN (date);
```

**Benefit.** Tiny on disk (KB, not MB even on huge tables); very
cheap writes.

**Cost.** Only useful when the column is naturally clustered on disk
(e.g., append-only insertion order matches `date`). For a query
returning 70% of rows, a BRIN scan is roughly equivalent to a Seq
Scan.

**Trigger.** Append-only time-series tables in the 100M+ row range
where storage cost of a B-tree becomes painful AND the column is
strongly correlated with physical row order.

## 8. Cost / benefit summary

| Strategy                 | Effort | Speedup vs. baseline | Storage | Trigger row count |
|--------------------------|--------|----------------------|---------|-------------------|
| Partial B-tree (chosen)  | low    | ~26x                 | tiny    | any               |
| Covering index           | low    | extra ~30-60%        | medium  | any               |
| Composite (date,status)  | low    | depends              | small   | any with status filter |
| Partitioning             | high   | depends              | none    | 10M+              |
| Materialized view        | medium | extreme for aggregates | medium | reporting workloads |
| Read replicas            | high   | horizontal           | 2x      | when primary saturates |
| BRIN                     | low    | situational          | tiny    | 100M+ append-only |

## 9. JOIN-aware optimization (the `a.*` reference)

The original prompt's `SELECT e.*, a.*` references an unjoined alias.
If the intended query was

```sql
SELECT e.*, a.*
FROM   events e
JOIN   events_attendees a ON a.event_id = e.id
WHERE  e.date > NOW()
ORDER  BY e.date ASC;
```

then the cheapest plan is a Nested Loop driven by the date-ordered
Index Scan on `events`, with an Index Scan on
`events_attendees.event_id` for each event row. Add:

```sql
CREATE INDEX CONCURRENTLY idx_events_attendees_event_id
    ON events_attendees (event_id);
```

If `events_attendees` is itself date-correlated (e.g., partitioned by
event date), partition pruning compounds the savings.

## 10. What we deliberately did NOT do

- We did not denormalize `is_future BOOLEAN` onto `events`. It is
  derived data that drifts every second; maintaining it correctly
  requires either triggers or a periodic job, both of which are more
  fragile and expensive than a partial index.
- We did not increase `work_mem`. The Sort is gone; raising
  `work_mem` would only paper over the symptom. Keep the global
  setting modest and let the index do the work.
- We did not cache results in Redis. At ~19 ms per query the network
  round-trip to Redis is comparable to the database hit, and Redis
  introduces a coherence problem (event creation must invalidate the
  cache). Only worth it for hot reads at much higher QPS.
