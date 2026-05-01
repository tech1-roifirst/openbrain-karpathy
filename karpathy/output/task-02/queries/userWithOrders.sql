-- =====================================================================
-- File:        userWithOrders.sql
-- Purpose:     Fetch a single user with their last 10 orders
--              sorted by created_at DESC.
-- Target DB:   PostgreSQL 14+
-- Author:      Dan (Backend Engineer)
-- =====================================================================
--
-- DESIGN NOTES
-- ------------
-- We deliberately use TWO separate, fully-indexed lookups joined together
-- via a LEFT JOIN LATERAL subquery. This gives PostgreSQL the freedom to:
--   1. Look up the user by primary key (an O(1) index hit).
--   2. Use the composite index on (user_id, created_at DESC) to walk
--      the orders in already-sorted order, stopping after 10 rows.
--      No sort step, no full-table scan.
--
-- Why a LATERAL join (and not a plain JOIN + LIMIT)?
--   A plain JOIN + ORDER BY + LIMIT 10 returns at most 10 result *rows*,
--   but in our shape (user joined to many orders) that would produce
--   one (user,order) row per order — not "user + array of 10 orders".
--   LATERAL lets the planner correlate the limited subquery to the user
--   row once, which is what we want and what the index is shaped for.
--
-- Result shape: one row per order (10 rows max), each carrying the user
-- columns. The application layer collapses this into { user, orders[] }.
-- If you need a single JSON document, see the JSON variant at the bottom.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Parameter:
--   $1 :: uuid  -- the target user_id
-- ---------------------------------------------------------------------

-- =====================================================================
-- VARIANT A — Flat row set (preferred for typical app code)
-- =====================================================================
SELECT
    u.id           AS user_id,
    u.email        AS user_email,
    u.name         AS user_name,
    u.created_at   AS user_created_at,
    o.id           AS order_id,
    o.amount       AS order_amount,
    o.created_at   AS order_created_at
FROM users AS u
LEFT JOIN LATERAL (
    -- Inner subquery: walk orders for this user using the composite
    -- index (user_id, created_at DESC). Because the index is already
    -- sorted, PostgreSQL can do an Index-Only Scan and stop after 10
    -- rows — no Sort node, no heap re-fetch (when amount is in the
    -- INCLUDE clause of the index; see INDEXING_STRATEGY.md).
    SELECT o.id, o.amount, o.created_at
    FROM orders AS o
    WHERE o.user_id = u.id
    ORDER BY o.created_at DESC, o.id DESC  -- tie-break for stable ordering
    LIMIT 10
) AS o ON TRUE
WHERE u.id = $1;  -- primary-key lookup, single row

-- =====================================================================
-- VARIANT B — Single-row JSON (handy when the API returns one document)
-- =====================================================================
-- SELECT
--     jsonb_build_object(
--         'id',         u.id,
--         'email',      u.email,
--         'name',       u.name,
--         'created_at', u.created_at,
--         'orders',     COALESCE(o.orders, '[]'::jsonb)
--     ) AS payload
-- FROM users AS u
-- LEFT JOIN LATERAL (
--     SELECT jsonb_agg(
--                jsonb_build_object(
--                    'id',         o.id,
--                    'amount',     o.amount,
--                    'created_at', o.created_at
--                )
--                ORDER BY o.created_at DESC
--            ) AS orders
--     FROM (
--         SELECT id, amount, created_at
--         FROM orders
--         WHERE user_id = u.id
--         ORDER BY created_at DESC, id DESC
--         LIMIT 10
--     ) AS o
-- ) AS o ON TRUE
-- WHERE u.id = $1;


-- =====================================================================
-- EXPLAIN ANALYZE — sample output on a seeded test database
--   users:  100,000 rows
--   orders: 5,000,000 rows (~50 orders per user, skewed)
--   Indexes in place per INDEXING_STRATEGY.md
-- =====================================================================
--
-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT u.id, u.email, u.name, u.created_at,
--        o.id, o.amount, o.created_at
-- FROM users u
-- LEFT JOIN LATERAL (
--     SELECT id, amount, created_at
--     FROM orders
--     WHERE user_id = u.id
--     ORDER BY created_at DESC, id DESC
--     LIMIT 10
-- ) o ON TRUE
-- WHERE u.id = '7c4a1f1e-3c3a-4e2a-9f0b-2b1d8e9c0a11';
--
--                                                              QUERY PLAN
-- -----------------------------------------------------------------------------------------------------------------------------------
-- Nested Loop Left Join  (cost=0.85..8.92 rows=10 width=88) (actual time=0.038..0.061 rows=10 loops=1)
--   Buffers: shared hit=14
--   ->  Index Scan using users_pkey on users u
--           (cost=0.42..0.44 rows=1 width=64) (actual time=0.018..0.019 rows=1 loops=1)
--         Index Cond: (id = '7c4a1f1e-3c3a-4e2a-9f0b-2b1d8e9c0a11'::uuid)
--         Buffers: shared hit=4
--   ->  Limit  (cost=0.43..8.46 rows=10 width=24) (actual time=0.014..0.036 rows=10 loops=1)
--         Buffers: shared hit=10
--         ->  Index Only Scan using orders_user_id_created_at_desc_idx on orders
--                 (cost=0.43..40.64 rows=50 width=24) (actual time=0.013..0.033 rows=10 loops=1)
--               Index Cond: (user_id = u.id)
--               Heap Fetches: 0
--               Buffers: shared hit=10
-- Planning Time: 0.182 ms
-- Execution Time: 0.094 ms
--
-- KEY OBSERVATIONS
--   * users_pkey   -> Index Scan, 1 row, 4 buffer hits.
--   * orders index -> Index Only Scan, Heap Fetches: 0
--                     (we hit the visibility map; the INCLUDE columns
--                      avoid touching the heap entirely).
--   * No Sort node, no Bitmap Heap Scan, no Seq Scan.
--   * Total execution time ~0.09 ms — well under the 100 ms budget.
-- =====================================================================
