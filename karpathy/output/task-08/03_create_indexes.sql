-- =============================================================================
-- Task 08 / Deliverable 3: Index Creation
-- =============================================================================
-- Apply against PostgreSQL 14+ (Supabase). All statements use CONCURRENTLY
-- so they do not block writes against `events`. CONCURRENTLY cannot run
-- inside a transaction block -- run each statement on its own.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- (1) PRIMARY CHOICE: partial B-tree on future events
-- -----------------------------------------------------------------------------
-- Why:
--   * The brief's hot query is WHERE date > NOW() ORDER BY date ASC.
--   * A partial index that mirrors the WHERE clause is the smallest
--     possible index that still serves the query, and it eliminates
--     both the Seq Scan and the Sort node.
--   * Caveat (NON-IMMUTABLE): NOW() is evaluated at index BUILD time,
--     not at query time. The boundary drifts as time passes; old "future"
--     rows that have since become "past" remain in the index. Plan a
--     REINDEX (see 08_monitoring.md) to keep the index lean. The
--     planner still uses this index for `date > NOW()` queries because
--     the runtime predicate is strictly stricter than the build-time
--     predicate (later NOW() >= earlier NOW()), so every row the query
--     wants is guaranteed to be in the index.
--
-- Estimated size: ~1.5-3 MB on a 100k-row table at 70% selectivity.
-- Estimated write overhead: +0.1-0.3 ms per write that satisfies the
-- predicate; ZERO additional cost for inserts of past-dated rows.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_future_dates
    ON public.events (date ASC)
    WHERE date > NOW();


-- -----------------------------------------------------------------------------
-- (2) FALLBACK / BROADER COVERAGE: non-partial B-tree on date
-- -----------------------------------------------------------------------------
-- Use this INSTEAD OF (1) if your workload mixes "future events" and
-- "past events" queries roughly evenly, or if you want a single index
-- that does not require periodic REINDEX maintenance.
--
-- Pros: zero maintenance drift; serves both `date > NOW()` and
--       `date < NOW()` queries equally well; serves arbitrary BETWEEN
--       ranges.
-- Cons: ~30% larger than the partial index because it covers past rows
--       that may rarely be queried.
--
-- Estimated size: ~2-4 MB on a 100k-row table.
-- Estimated write overhead: +0.1-0.3 ms per write.
--
-- Deploy the partial index first; add this only if monitoring shows
-- a meaningful share of queries hit past events.

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_date
--     ON public.events (date ASC);


-- -----------------------------------------------------------------------------
-- (3) OPTIONAL: composite index for status-filtered variants
-- -----------------------------------------------------------------------------
-- Add only if queries like
--   WHERE date > NOW() AND status = 'active'
-- become hot. PostgreSQL can use the leading `date` column for the
-- range scan and the trailing `status` column to narrow the result
-- without a heap visit. Leading the index with `date` (the range
-- column) is correct for this access pattern; leading with `status`
-- would be wrong because B-trees cannot range-scan after a non-equality
-- predicate.

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_date_status
--     ON public.events (date ASC, status)
--     WHERE date > NOW();


-- -----------------------------------------------------------------------------
-- (4) OPTIONAL: covering index for narrow projections
-- -----------------------------------------------------------------------------
-- Use ONLY when queries select a small, FIXED column list (e.g., for an
-- "upcoming events" widget). Do NOT use with SELECT * -- the INCLUDE
-- list would duplicate the entire row and double the on-disk footprint.
--
-- Example workload: SELECT id, date, name FROM events WHERE date > NOW()
-- ORDER BY date ASC LIMIT 20;

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_upcoming_covering
--     ON public.events (date ASC)
--     INCLUDE (id, name)
--     WHERE date > NOW();


-- -----------------------------------------------------------------------------
-- (5) JOIN-AWARE variant (if `e.*, a.*` was meant to JOIN attendees)
-- -----------------------------------------------------------------------------
-- The original prompt referenced `a.*` with no JOIN clause. If `a` was
-- intended to be an `events_attendees` table, the inner join benefits
-- from an index on the FK column. Index FKs that drive joins; the
-- planner can then choose a Nested Loop with an Index Scan on the
-- attendees side.

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_attendees_event_id
--     ON public.events_attendees (event_id);


-- -----------------------------------------------------------------------------
-- Statistics refresh
-- -----------------------------------------------------------------------------
-- After creating indexes, run ANALYZE so the planner has accurate
-- selectivity estimates against the new indexes. CREATE INDEX
-- CONCURRENTLY does not auto-ANALYZE.

ANALYZE public.events;


-- -----------------------------------------------------------------------------
-- Schema cache reload (Supabase / PostgREST)
-- -----------------------------------------------------------------------------
-- Required so the REST API re-reads index metadata for query planning.
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- Index size estimate (verification query)
-- =============================================================================
-- Run AFTER deployment to confirm sizes match expectations.

-- SELECT
--     i.indexrelname AS index_name,
--     pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
--     i.idx_scan      AS times_used,
--     i.idx_tup_read  AS tuples_read,
--     i.idx_tup_fetch AS tuples_fetched
-- FROM pg_stat_user_indexes i
-- WHERE i.relname = 'events'
-- ORDER BY pg_relation_size(i.indexrelid) DESC;


-- =============================================================================
-- Roll-back (down migration)
-- =============================================================================
-- Every CREATE has a matching DROP. CONCURRENTLY is also valid on DROP.

-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_future_dates;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_date;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_date_status;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_upcoming_covering;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_attendees_event_id;
