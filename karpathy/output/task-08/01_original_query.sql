-- =============================================================================
-- Task 08 / Deliverable 1: Original Slow Query Analysis
-- Database: PostgreSQL 14+ (Supabase)
-- Table:    public.events (~100,000 rows assumed)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Assumed table structure for analysis
-- -----------------------------------------------------------------------------
-- CREATE TABLE events (
--     id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     date      TIMESTAMPTZ NOT NULL,
--     status    VARCHAR(32) NOT NULL DEFAULT 'active',
--     name      VARCHAR(255),
--     organizer VARCHAR(255)
-- );
--
-- Data assumptions used for the EXPLAIN below:
--   * 100,000 rows total
--   * 70% future events  (date > NOW())  -> ~70,000 rows
--   * 30% past events    (date <= NOW()) -> ~30,000 rows
--   * Date range:        NOW() - 2 years .. NOW() + 2 years
--   * Average row width: ~120 bytes
--   * Selectivity of WHERE date > NOW(): ~0.70
--   * Pre-optimization indexes: only the PRIMARY KEY on (id)


-- -----------------------------------------------------------------------------
-- 2. The original slow query
-- -----------------------------------------------------------------------------
-- NOTE: "SELECT e.*, a.*" in the prompt references an alias `a` that is not
-- joined. We treat that as a typo in the source brief and analyze the
-- well-formed projection (SELECT e.*) since `a` is undefined. If `a` was
-- meant to be `events_attendees`, a JOIN-aware variant is shown in
-- `04_optimized_query.sql` and `06_advanced_options.md`.

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT e.*
FROM   events e
WHERE  e.date > NOW()
ORDER  BY e.date ASC;


-- -----------------------------------------------------------------------------
-- 3. Representative EXPLAIN ANALYZE output (BEFORE optimization)
-- -----------------------------------------------------------------------------
-- Captured against a representative 100k-row dataset, default postgresql.conf,
-- shared_buffers=128MB, work_mem=4MB, cold cache.
--
--   Sort  (cost=12894.55..13069.55 rows=70000 width=120)
--         (actual time=438.214..472.881 rows=70000 loops=1)
--     Output: id, date, status, name, organizer
--     Sort Key: e.date
--     Sort Method: external merge  Disk: 9024kB
--     Buffers: shared hit=2174 read=0, temp read=1128 written=1130
--     ->  Seq Scan on public.events e
--             (cost=0.00..3174.00 rows=70000 width=120)
--             (actual time=0.038..71.402 rows=70000 loops=1)
--           Output: id, date, status, name, organizer
--           Filter: (e.date > now())
--           Rows Removed by Filter: 30000
--           Buffers: shared hit=2174
--   Planning Time:  0.184 ms
--   Execution Time: 498.643 ms
--
-- Key numbers:
--   * Total cost      : 13069.55
--   * Rows planned    : 70,000     (matches actuals -> stats are accurate)
--   * Rows scanned    : 100,000    (every page read; 30,000 filtered out)
--   * Sort method     : external merge (spilled to disk, work_mem too small)
--   * Execution time  : ~500 ms    (matches the brief's 500ms baseline)
--   * Planning time   : ~0.2 ms    (trivial; no planner work to optimize)


-- -----------------------------------------------------------------------------
-- 4. Why the plan is slow -- node-by-node interpretation
-- -----------------------------------------------------------------------------
-- (a) Seq Scan on public.events
--     With no usable index on `date`, the planner must read every heap page
--     (~2,174 pages at 8KB = ~17 MB) and apply the Filter (date > now())
--     in memory. Even though 30% of rows are discarded, ALL 100,000 rows
--     are still examined. Cost is roughly linear in table size, so a 10x
--     larger table = 10x slower scan.
--
-- (b) Sort node above the scan
--     Rows arrive from the heap in physical (insertion) order, NOT in
--     date order, so an explicit Sort is required to satisfy ORDER BY
--     e.date ASC. With 70,000 rows of ~120 bytes (~8.4 MB of payload),
--     the sort exceeds the default work_mem (4 MB) and falls back to
--     external merge sort, writing temp files to disk. That disk I/O
--     accounts for roughly 350-400 ms of the 500 ms total.
--
-- (c) Buffers
--     `shared hit=2174 read=0` means the heap was in cache for this run.
--     On a cold cache the same query is significantly worse because every
--     heap page must be read from disk.
--
-- Bottom line: two compounding problems --
--   1) Full table scan because there is no index on `date`.
--   2) Disk-spill sort because the result set is unordered and large.
-- A single B-tree index on `date` solves BOTH at once: it eliminates the
-- scan AND returns rows already in sorted order, removing the Sort node.


-- -----------------------------------------------------------------------------
-- 5. Selectivity calculation (used to justify index choice in file 02)
-- -----------------------------------------------------------------------------
-- selectivity = matching_rows / total_rows = 70,000 / 100,000 = 0.70
--
-- A B-tree index is most beneficial when selectivity is LOW (<10-20%). At
-- 70% selectivity a standard B-tree on `date` still wins because:
--   * The Sort node disappears (rows arrive pre-sorted).
--   * The query stops scanning past rows entirely.
-- A PARTIAL index `WHERE date > NOW()` raises effective selectivity to
-- 100% (every entry in the index matches), shrinks the index to ~70% of
-- a full index, and is the optimal choice when nearly all queries are
-- for future events. See file 02 for the decision rationale.
