# Task 08 / Deliverable 8: Monitoring & Maintenance

The optimization is only valuable if it stays healthy in production.
This file defines what to watch, what thresholds to alert on, and
what cadence to run maintenance jobs at.

## 1. Index usage -- pg_stat_user_indexes

Confirms the planner is actually picking the new index. Run weekly.

```sql
SELECT
    schemaname,
    relname        AS table_name,
    indexrelname   AS index_name,
    idx_scan       AS times_used,
    idx_tup_read   AS tuples_returned_by_index,
    idx_tup_fetch  AS rows_fetched_via_index,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM   pg_stat_user_indexes
WHERE  relname = 'events'
ORDER  BY idx_scan DESC;
```

**Healthy signal.** `idx_events_future_dates.idx_scan` increases
steadily and is the largest of the indexes on `events`.

**Red flag.** `idx_scan = 0` after a week of traffic = the planner
isn't using the index. Causes to check:
- Stats are stale -> run `ANALYZE events;`.
- A query rewrite (e.g. `WHERE date::date > current_date`) made the
  predicate non-sargable.
- A different index is preferred -- inspect `EXPLAIN`.

## 2. Detecting unused indexes (write-bloat detector)

```sql
SELECT
    s.schemaname,
    s.relname        AS table_name,
    s.indexrelname   AS index_name,
    s.idx_scan,
    pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size
FROM   pg_stat_user_indexes s
JOIN   pg_index i ON i.indexrelid = s.indexrelid
WHERE  s.idx_scan = 0
  AND  NOT i.indisunique           -- never drop unique/PK indexes
  AND  NOT i.indisprimary
  AND  s.schemaname = 'public'
ORDER  BY pg_relation_size(s.indexrelid) DESC;
```

Anything appearing here with non-trivial size has been paying write
overhead for nothing. Drop after a confirmation window of 30 days.

## 3. Index size growth

The partial index drifts upward over time because `NOW()` is fixed at
build time (see file 02 section 4 and file 06 section 6). Track size
weekly:

```sql
SELECT
    indexrelname,
    pg_size_pretty(pg_relation_size(indexrelid))         AS size_pretty,
    pg_relation_size(indexrelid)                         AS size_bytes,
    pg_relation_size(indexrelid)::float
        / NULLIF(pg_relation_size('public.events'), 0)   AS ratio_to_table
FROM   pg_stat_user_indexes
WHERE  relname = 'events';
```

**Threshold.** When `idx_events_future_dates` exceeds ~1.3x its
post-REINDEX baseline size, schedule a `REINDEX CONCURRENTLY`.

## 4. Query latency monitoring (pg_stat_statements)

Enable `pg_stat_statements` once per database; then query for the
hot SELECT.

```sql
SELECT
    query,
    calls,
    round(mean_exec_time::numeric, 2)   AS mean_ms,
    round(stddev_exec_time::numeric, 2) AS stddev_ms,
    round(max_exec_time::numeric, 2)    AS max_ms,
    rows
FROM   pg_stat_statements
WHERE  query ILIKE '%FROM events%date > now()%'
ORDER  BY mean_exec_time DESC
LIMIT  10;
```

**Alert thresholds** (suggested SLOs):

| Metric              | Warn       | Page       |
|---------------------|------------|------------|
| `mean_exec_time`    | > 50 ms    | > 200 ms   |
| `max_exec_time`     | > 500 ms   | > 2,000 ms |
| `stddev_exec_time`  | > 100 ms   | n/a        |

A `mean_exec_time` regression usually points at one of: stale stats,
the planner choosing a different (worse) plan, or autovacuum falling
behind on the heap.

## 5. VACUUM / autovacuum

For the `events` table:

```sql
SELECT
    relname,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup,
    last_autovacuum,
    last_autoanalyze
FROM   pg_stat_user_tables
WHERE  relname = 'events';
```

**Healthy signal.** `n_dead_tup / n_live_tup` < 10%; autovacuum runs
within the past 24 hours on a write-active table.

**Action.** If dead-tuple ratio climbs above 20%, tighten autovacuum
for this table:

```sql
ALTER TABLE events SET (
    autovacuum_vacuum_scale_factor  = 0.05,   -- default 0.20
    autovacuum_analyze_scale_factor = 0.02    -- default 0.10
);
```

## 6. REINDEX schedule

| Index                          | Cadence    | Reason |
|--------------------------------|------------|--------|
| `idx_events_future_dates`      | monthly    | partial-index drift; rebuild reclaims past-rolled entries |
| Other B-tree indexes on events | quarterly  | bloat from updates; only needed if `pgstattuple` shows fragmentation |

```sql
-- Online, non-blocking; safe to run during business hours.
REINDEX INDEX CONCURRENTLY idx_events_future_dates;
```

If `REINDEX CONCURRENTLY` fails (e.g., a long-running transaction
holds a conflicting lock), an `INVALID` index is left behind. Detect
and clean up:

```sql
SELECT indexrelid::regclass AS invalid_index
FROM   pg_index
WHERE  indisvalid = false;

-- DROP INDEX CONCURRENTLY <invalid_index>;
-- then re-issue the original CREATE INDEX CONCURRENTLY.
```

## 7. Buffer cache hit ratio

```sql
SELECT
    sum(heap_blks_hit)::float
        / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) AS heap_hit_ratio,
    sum(idx_blks_hit)::float
        / NULLIF(sum(idx_blks_hit)  + sum(idx_blks_read),  0) AS index_hit_ratio
FROM   pg_statio_user_tables
WHERE  relname = 'events';
```

**Target.** Both ratios > 0.99 for a healthy hot working set. If the
index hit ratio drops, either `shared_buffers` is undersized for the
combined working set, or some larger query has evicted index pages.

## 8. Plan-shape regression alarm

Wire the assertion from `07_test_queries.sql` Section G into CI or a
periodic synthetic check. Page if `EXPLAIN` ever returns `Seq Scan
on events` for the canonical query, even if latency happens to be
fine in the moment -- the alternative plan is one cache eviction
away from disaster.

## 9. Maintenance schedule -- summary

| Task                                | Cadence          | Owner    |
|-------------------------------------|------------------|----------|
| `ANALYZE events`                    | autovacuum (auto)| platform |
| Review `pg_stat_user_indexes`       | weekly           | data eng |
| Review `pg_stat_statements` for SLO | daily (alerts)   | platform |
| `REINDEX idx_events_future_dates`   | monthly          | data eng |
| Audit unused indexes                | quarterly        | data eng |
| Validate plan shape (CI)            | every deploy     | CI       |

## 10. When to escalate

Escalate to Archi (architect) and Nova (backend) if any of:
- Mean latency exceeds 200 ms for >= 1 hour even after `ANALYZE` and
  `REINDEX` -- may signal the table outgrew the partial-index strategy
  and needs partitioning (file 06 section 3).
- Write latency on `events` exceeds the +0.5 ms budget -- may signal
  index bloat or a need to drop redundant indexes.
- A new query pattern emerges that consistently appears with `Seq
  Scan` in EXPLAIN -- likely needs a new (composite or covering)
  index. Coordinate the schema change as a normal migration so the
  CONCURRENT build is part of the deploy plan.
