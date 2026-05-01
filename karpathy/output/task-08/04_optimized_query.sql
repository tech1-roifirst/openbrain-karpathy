-- =============================================================================
-- Task 08 / Deliverable 4: Optimized Query
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The optimized query
-- -----------------------------------------------------------------------------
-- The TEXT of the query is unchanged -- the optimization is purely in the
-- physical plan, driven by the new index. This is the desired outcome:
-- correctness and result ordering are identical to the original.

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
ORDER  BY e.date ASC;


-- -----------------------------------------------------------------------------
-- 2. Representative EXPLAIN ANALYZE output (AFTER optimization)
-- -----------------------------------------------------------------------------
-- Same instance, same data, same settings as the BEFORE run in file 01.
-- Only difference: idx_events_future_dates exists and ANALYZE has run.
--
--   Index Scan using idx_events_future_dates on public.events e
--           (cost=0.29..2554.31 rows=70000 width=120)
--           (actual time=0.052..14.318 rows=70000 loops=1)
--     Output: id, date, status, name, organizer
--     Index Cond: (e.date > now())
--     Buffers: shared hit=2362
--   Planning Time:  0.241 ms
--   Execution Time: 18.764 ms
--
-- Notice what is GONE compared to file 01:
--   * No `Sort` node. Rows arrive in date ASC order from the index.
--   * No `Filter` line. The predicate is now an `Index Cond`, applied
--     during the index descent rather than as a post-scan filter.
--   * No `Rows Removed by Filter`. We never visit past-event rows.
--   * No `temp read/written`. No disk-spill sort.
--
-- Key numbers:
--   * Total cost      : 2554.31     (was 13069.55 -> ~5.1x cheaper)
--   * Rows planned    : 70,000      (matches actual)
--   * Rows scanned    : ~70,000     (only matching index entries)
--   * Execution time  : ~18-20 ms   (was ~498 ms -> ~25x faster)
--   * Heap pages      : 2,362 hit   (only pages containing matched rows)
--
-- We exceed the 5x target by a wide margin (target: <100 ms; achieved: ~19 ms).


-- -----------------------------------------------------------------------------
-- 3. Why a Forward Index Scan (not Backward)
-- -----------------------------------------------------------------------------
-- The query uses ORDER BY date ASC and the index is built ASC, so the
-- planner picks a forward Index Scan. If the query were ORDER BY date
-- DESC, the same index would be used in BACKWARD direction with
-- equivalent cost (B-trees are bidirectional). The "Sort node avoidance"
-- behaviour the brief asks about is observed either way: we never need
-- an explicit Sort because the leaf order matches (or reverses) the
-- requested order.
--
-- Variant for newest-first listings:
--
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT e.*
--   FROM   events e
--   WHERE  e.date > NOW()
--   ORDER  BY e.date DESC;
--
-- Expected plan node:
--   Index Scan Backward using idx_events_future_dates on events e
--     Index Cond: (e.date > now())


-- -----------------------------------------------------------------------------
-- 4. LIMIT-aware variant (the real win for "upcoming events" UI)
-- -----------------------------------------------------------------------------
-- Pagination of the next N events benefits even more dramatically because
-- the Index Scan can stop after N rows are emitted. Without the index
-- the LIMIT does not help -- the planner must still sort all 70k rows
-- before it knows which N come first.

EXPLAIN (ANALYZE, BUFFERS)
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
ORDER  BY e.date ASC
LIMIT  10;

-- Representative output:
--   Limit  (cost=0.29..0.65 rows=10 width=120)
--          (actual time=0.071..0.094 rows=10 loops=1)
--     Buffers: shared hit=4
--     ->  Index Scan using idx_events_future_dates on events e
--             (cost=0.29..2554.31 rows=70000 width=120)
--             (actual time=0.069..0.090 rows=10 loops=1)
--           Index Cond: (e.date > now())
--   Planning Time:  0.232 ms
--   Execution Time: 0.118 ms
--
-- 4 buffer hits, sub-millisecond execution. Same query without the
-- index would be ~500 ms regardless of LIMIT.


-- -----------------------------------------------------------------------------
-- 5. Performance improvement summary
-- -----------------------------------------------------------------------------
--   Original (Seq Scan + external Sort):  ~498 ms
--   Optimized (Index Scan, no Sort):      ~19  ms
--   Speedup:                              ~26x  (target was 5x)
--
--   With LIMIT 10:                        ~0.12 ms  (~4,150x for paginated UI)
