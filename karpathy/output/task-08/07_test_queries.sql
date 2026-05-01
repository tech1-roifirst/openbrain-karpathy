-- =============================================================================
-- Task 08 / Deliverable 7: Testing & Validation
-- =============================================================================
-- Run AFTER deploying the indexes from 03_create_indexes.sql.
-- Each block is independent and can be executed in isolation.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Section A: Correctness -- result set parity
-- -----------------------------------------------------------------------------
-- Confirms that the optimized plan returns the same rows in the same
-- order as a forced sequential scan. Uses enable_indexscan/enable_seqscan
-- session toggles to compare both plans against the same data.

-- A.1 Row count parity (must be identical to A.2)
SELECT COUNT(*) AS optimized_count
FROM   events
WHERE  date > NOW();

-- A.2 Forced Seq Scan reference count
SET LOCAL enable_indexscan       = off;
SET LOCAL enable_indexonlyscan   = off;
SET LOCAL enable_bitmapscan      = off;
SELECT COUNT(*) AS seq_scan_count
FROM   events
WHERE  date > NOW();
RESET enable_indexscan;
RESET enable_indexonlyscan;
RESET enable_bitmapscan;

-- A.3 Order-preservation check: first 100 IDs from each plan must match.
WITH idx_plan AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY date ASC, id ASC) AS rn
    FROM   events
    WHERE  date > NOW()
    LIMIT  100
)
SELECT * FROM idx_plan ORDER BY rn;
-- (compare against the same query with enable_indexscan=off)


-- -----------------------------------------------------------------------------
-- Section B: Verify index usage in the plan
-- -----------------------------------------------------------------------------
-- The top scan node must be Index Scan or Index Only Scan, never Seq Scan.

EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
ORDER  BY e.date ASC;
-- Expect: "Index Scan using idx_events_future_dates"


-- -----------------------------------------------------------------------------
-- Section C: Query variations from the brief
-- -----------------------------------------------------------------------------

-- C.1 Original
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
ORDER  BY e.date ASC;

-- C.2 With LIMIT (typical "next N events" UI)
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
ORDER  BY e.date ASC
LIMIT  10;
-- Expect: Limit -> Index Scan; sub-millisecond execution.

-- C.3 With LIMIT/OFFSET pagination
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
ORDER  BY e.date ASC
LIMIT  10 OFFSET 200;
-- Expect: Limit -> Index Scan. Note OFFSET still walks the skipped rows;
-- prefer keyset pagination on (date, id) for deep pagination.

-- C.4 With additional status filter
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
  AND  e.status = 'active'
ORDER  BY e.date ASC;
-- Expect: Index Scan + Filter (status = 'active'). If this query is hot,
-- add the composite index from 03_create_indexes.sql section (3).

-- C.5 Reverse order (latest future events first)
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
ORDER  BY e.date DESC
LIMIT  10;
-- Expect: "Index Scan Backward". Same B-tree, no Sort.

-- C.6 Bounded future range
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER  BY e.date ASC;
-- Expect: Index Scan with two-sided Index Cond.


-- -----------------------------------------------------------------------------
-- Section D: Negative tests -- queries that should NOT use the partial index
-- -----------------------------------------------------------------------------
-- These confirm we have not over-optimized at the expense of other paths.

-- D.1 Past events: partial index excludes these rows -> Seq Scan expected
--     (or: a different index, e.g. the non-partial idx_events_date if you
--     deployed it as well).
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.date < NOW()
ORDER  BY e.date DESC;
-- Expect: Seq Scan + Sort (this is the expected cost of the partial-index
-- choice; see 02_optimization_strategy.md section 7).

-- D.2 Filter on a column not in the index
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.organizer = 'ACME Corp'
ORDER  BY e.name;
-- Expect: Seq Scan. The partial index does not (and should not) help here.

-- D.3 No date filter at all
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM events;
-- Expect: Seq Scan or parallel Seq Scan. No index helps a full count.


-- -----------------------------------------------------------------------------
-- Section E: Synthetic data harness for benchmarking
-- -----------------------------------------------------------------------------
-- Generate a 100k-row test fixture matching the brief's data distribution.
-- Run once in a scratch schema; do NOT run in production.
--
-- 70% of rows are future-dated within the next 2 years.
-- 30% are past-dated within the last 2 years.

-- DROP TABLE IF EXISTS bench_events;
-- CREATE TABLE bench_events (
--     id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     date      TIMESTAMPTZ NOT NULL,
--     status    VARCHAR(32)  NOT NULL DEFAULT 'active',
--     name      VARCHAR(255) NOT NULL,
--     organizer VARCHAR(255) NOT NULL
-- );
--
-- INSERT INTO bench_events (date, status, name, organizer)
-- SELECT
--     CASE
--         WHEN random() < 0.70
--             THEN NOW() + (random() * INTERVAL '730 days')   -- future, 0..2y
--         ELSE NOW() - (random() * INTERVAL '730 days')        -- past, 0..2y
--     END                                       AS date,
--     (ARRAY['active','draft','cancelled'])[1 + floor(random() * 3)::int],
--     'Event ' || gs::text                      AS name,
--     'Organizer ' || (1 + floor(random() * 500))::text AS organizer
-- FROM generate_series(1, 100000) AS gs;
--
-- ANALYZE bench_events;


-- -----------------------------------------------------------------------------
-- Section F: Scaling sanity checks
-- -----------------------------------------------------------------------------
-- Run after generating fixtures of different sizes (1k / 10k / 100k / 1M).
-- The Index Scan plan should remain dominant at every scale; execution
-- time should grow roughly with O(log n + result_size) -- NOT linearly
-- with table size (which is what the original Seq Scan plan does).

-- Expected execution times for the unbounded query (ORDER BY date ASC,
-- no LIMIT). These are order-of-magnitude estimates; actual numbers
-- vary by hardware and cache state.
--
--   1k     rows : <1 ms     (entire table fits on a few pages)
--   10k    rows : ~3 ms     (~7,000 returned rows)
--   100k   rows : ~19 ms    (~70,000 returned rows -- the brief's number)
--   1M     rows : ~180 ms   (~700,000 returned rows; result-set IO dominates)
--
-- For unbounded "give me ALL future events" against very large tables,
-- result-set IO becomes the bottleneck regardless of indexing -- consider
-- pagination via LIMIT (file 04 section 4) or partitioning (file 06).


-- -----------------------------------------------------------------------------
-- Section G: Regression guard
-- -----------------------------------------------------------------------------
-- A simple assertion you can wire into CI: fail if the planner ever
-- chooses Seq Scan for the canonical query.

DO $$
DECLARE
    plan_text text;
BEGIN
    EXECUTE format($q$
        EXPLAIN (FORMAT TEXT)
        SELECT e.* FROM events e
        WHERE  e.date > NOW()
        ORDER  BY e.date ASC
    $q$) INTO plan_text;

    -- Concatenate all rows of the EXPLAIN output (in real CI, capture
    -- it with a SELECT into an array; this DO block is illustrative).
    IF plan_text ILIKE '%Seq Scan on events%' THEN
        RAISE EXCEPTION
            'Regression: events query is using Seq Scan. '
            'Check that idx_events_future_dates exists and is VALID.';
    END IF;
END$$;
