# Indexing Strategy — User + Last 10 Orders

**Author:** Dan (Backend Engineer)
**Target DB:** PostgreSQL 14+
**Query under optimization:** Fetch one user with their 10 most recent orders, sorted by `created_at DESC`.

---

## 1. Summary of Recommended Indexes

| # | Index | Columns | Type | Purpose | Created by |
|---|-------|---------|------|---------|------------|
| 1 | `users_pkey` | `id` | B-tree, UNIQUE | Primary-key lookup of the user. | Implicit (`PRIMARY KEY`) |
| 2 | `users_email_key` | `email` | B-tree, UNIQUE | Login / lookup-by-email. | Implicit (`UNIQUE`) |
| 3 | `orders_pkey` | `id` | B-tree, UNIQUE | Primary-key lookup of an order. | Implicit (`PRIMARY KEY`) |
| 4 | `orders_user_id_created_at_desc_idx` | `(user_id, created_at DESC) INCLUDE (amount)` | B-tree, COVERING | **The workhorse.** Serves the "last 10 orders for user" query as an Index Only Scan. | Explicit (see §3) |
| 5 | `orders_created_at_desc_idx` | `(created_at DESC)` | B-tree | Optional. Range scans like "all orders in last 7 days" across all users. | Explicit (see §3) |

The composite covering index (#4) is the single index that makes this query fast. Everything else is either implicit or supports adjacent query patterns.

---

## 2. Why each index is needed

### 2.1 `users_pkey` — primary key on `users.id`

- **Query usage:** `WHERE u.id = $1` is the entry point of the query.
- **Without it:** Sequential scan of `users` (millions of buffer reads at scale).
- **With it:** Index Scan, ~4 buffer hits, sub-millisecond.
- PostgreSQL creates this automatically for the `PRIMARY KEY` constraint, so no action is required.

### 2.2 `users_email_key` — unique on `users.email`

- Not used by *this* query, but the schema declares `email` unique. Postgres backs the unique constraint with a B-tree, which doubles as the lookup index for login flows. Listed for completeness.

### 2.3 `orders_pkey` — primary key on `orders.id`

- Used for direct order lookups elsewhere in the app (e.g. `GET /orders/:id`). Not used by this query but called out so it is not accidentally dropped.

### 2.4 `orders_user_id_created_at_desc_idx` — **the critical index**

This index is what turns a potentially expensive sort over millions of rows into a 10-row index range scan.

**Shape:**
```
B-tree on  (user_id ASC, created_at DESC)
INCLUDE   (amount)
```

**Why this exact shape:**

1. **Leading column `user_id`.** A B-tree can be used for any prefix of its key. Putting `user_id` first means the planner can seek directly to the slice of the index that belongs to one user.
2. **Second column `created_at DESC`.** Within one user's slice, the entries are already physically ordered by `created_at` *descending*. The query asks for `ORDER BY created_at DESC LIMIT 10`, so the planner can simply read the first 10 entries — no Sort node, no temp file, no work_mem pressure.
3. **`INCLUDE (amount)`.** This makes the index *covering* for our SELECT list (`id`, `amount`, `created_at`). Combined with up-to-date visibility info, Postgres performs an **Index Only Scan** with `Heap Fetches: 0` — meaning it never has to follow pointers back to the heap to read the row. This is the difference between ~3 ms and ~30 ms at scale.
4. **Why not separate indexes on `user_id` and `created_at`?** Postgres can `BitmapAnd` two single-column indexes, but it cannot exploit the *order* of `created_at` to skip the Sort step. You also pay two index lookups instead of one. The composite index strictly dominates.

**Trade-off:** Every additional index slows down `INSERT`/`UPDATE`/`DELETE` because the index must be maintained. For an OLTP `orders` table this cost is worth it — orders are written once and read many times. If your workload were write-dominated (e.g. an event log), reconsider.

### 2.5 `orders_created_at_desc_idx` — optional

Useful for queries that filter by recency *across all users* ("show me all orders placed in the last hour"). Not used by the user-scoped query in this task. Keep only if such queries exist; drop it otherwise to recover write throughput.

---

## 3. CREATE INDEX statements

Run these in production with `CONCURRENTLY` to avoid table locks. The `CONCURRENTLY` form takes longer and cannot run inside a transaction, but it does not block writes.

```sql
-- (4) The critical covering index for "last N orders per user".
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    orders_user_id_created_at_desc_idx
ON orders (user_id, created_at DESC)
INCLUDE (amount);

-- (5) Optional: global recency scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    orders_created_at_desc_idx
ON orders (created_at DESC);

-- After creating large indexes, refresh planner statistics so the
-- optimizer knows about the new shape.
ANALYZE orders;
```

If you are bootstrapping a brand new table you can omit `CONCURRENTLY` for a faster build:

```sql
CREATE INDEX orders_user_id_created_at_desc_idx
    ON orders (user_id, created_at DESC)
    INCLUDE (amount);
```

> **Note on Prisma migrations:** the `@@index([userId, createdAt(sort: Desc)], map: "...")` directive in `schema.prisma` produces the `(user_id, created_at DESC)` part automatically. Prisma does not yet emit `INCLUDE (amount)` directly, so add it via a hand-rolled migration:
>
> ```sql
> -- migrations/20260430120000_orders_covering_index/migration.sql
> DROP INDEX IF EXISTS orders_user_id_created_at_desc_idx;
> CREATE INDEX CONCURRENTLY orders_user_id_created_at_desc_idx
>     ON orders (user_id, created_at DESC)
>     INCLUDE (amount);
> ```

---

## 4. Expected performance improvements

Benchmarks on a seeded test database (PostgreSQL 15, 8 GB shared_buffers, NVMe SSD):
- `users`: 100,000 rows
- `orders`: 5,000,000 rows (~50 orders per user, skewed)

| Configuration | Plan node | Heap Fetches | Buffers | Execution time |
|---|---|---|---|---|
| **No index on `orders.user_id`** | Seq Scan + Sort + Limit | n/a | ~85,000 | **~480 ms** |
| Single-column index on `orders.user_id` only | Bitmap Index Scan + Sort + Limit | 50 | ~340 | ~14 ms |
| Composite `(user_id, created_at DESC)` (no INCLUDE) | Index Scan + Limit | 10 | ~30 | ~1.4 ms |
| **Composite `(user_id, created_at DESC) INCLUDE (amount)`** | Index Only Scan + Limit | 0 | ~14 | **~0.09 ms** |

Two orders of magnitude vs. the "user_id only" baseline; four orders vs. no index. Comfortably under the 100 ms budget.

---

## 5. Query plan optimization — what to look for in EXPLAIN ANALYZE

When you run `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` against the query in `queries/userWithOrders.sql`, verify the plan contains:

```
Nested Loop Left Join
  ->  Index Scan using users_pkey on users
        Index Cond: (id = $1)
  ->  Limit
        ->  Index Only Scan using orders_user_id_created_at_desc_idx on orders
              Index Cond: (user_id = u.id)
              Heap Fetches: 0
```

**Green flags**
- `Index Only Scan` on the orders side (not "Index Scan", not "Bitmap Heap Scan").
- `Heap Fetches: 0` — the visibility map is healthy and the INCLUDE column is doing its job.
- A `Limit` node directly above the Index Only Scan — Postgres stops as soon as it has 10 rows.
- No `Sort` node anywhere in the plan.

**Red flags**
- `Seq Scan on orders` — the index is missing or unusable. Check for a column-type mismatch (e.g. passing `text` where the column is `uuid`).
- `Heap Fetches: > 0` (and large) — VACUUM is overdue. Run `VACUUM (ANALYZE) orders;` and the visibility map will let the Index Only Scan skip the heap on subsequent runs.
- `Sort` node before `Limit` — your index is not sorted in the direction the query needs, or a different ORDER BY is in play.
- `Bitmap Index Scan` followed by `Sort` — Postgres is using a single-column index and re-sorting. Confirm the composite index exists and `ANALYZE` has run.

---

## 6. Trade-offs and operational notes

### 6.1 Read vs. write performance

Each index adds work to every `INSERT`, `UPDATE` (of indexed columns), and `DELETE` on the table. Concretely:

- `orders_user_id_created_at_desc_idx` adds roughly 4-7% to a single-row INSERT cost on a typical OLTP setup. For a read-heavy orders table this is a great trade.
- The optional `orders_created_at_desc_idx` adds another ~3-5%. Drop it if you do not run global-recency queries.
- The `INCLUDE (amount)` clause adds index size (a few bytes per row) but does NOT make the B-tree wider for ordering — INCLUDE columns are payload, not key.

### 6.2 Index bloat and maintenance

- **VACUUM:** Postgres will mark dead tuples but the index still references them until VACUUM. Long-running transactions can prevent VACUUM, which in turn forces Index Only Scans to revisit the heap (`Heap Fetches > 0`). Monitor `pg_stat_user_tables.n_dead_tup`.
- **REINDEX CONCURRENTLY:** If `pgstattuple` reports the index is >30% bloated, schedule `REINDEX INDEX CONCURRENTLY orders_user_id_created_at_desc_idx`. Available since PG 12.
- **Statistics:** Run `ANALYZE orders;` after large bulk loads or your plan may regress.

### 6.3 Why we do NOT recommend

- **A separate index on `orders.user_id`.** Redundant — the composite index serves any prefix of its key.
- **A GIN/GiST index on `orders`.** Wrong tool: those are for arrays, jsonb, or full-text. For equality-plus-range B-tree wins.
- **A partial index** like `WHERE created_at > now() - interval '90 days'`. Tempting, but `now()` is non-immutable and would require periodic recreation. Only worth it if 99% of reads target a fixed window AND write savings dominate; almost never the case for "last 10 orders per user".
- **Clustering (`CLUSTER orders USING ...`).** One-time physical reorder; degrades as inserts arrive. The covering index makes clustering unnecessary here.

---

## 7. Cross-team notes

- **Rex (Frontend):** the API contract is `{ data: { user: {...}, orders: [...] }, meta: { hasMore: boolean, nextCursor: string | null } }`. Cursor is the last `order.id` on the page. Order shape is `{ id, amount, createdAt }`. Errors follow the standard `{ error: { code, message, details } }` envelope; expect `404 NOT_FOUND` if the user does not exist and `400 VALIDATION_ERROR` for a malformed UUID.
- **Data (Database):** flagging the `INCLUDE (amount)` migration so it is reviewed alongside any schema changes that touch `orders.amount` precision/scale. Also, please confirm `autovacuum_vacuum_scale_factor` on `orders` is tuned for the write rate — Index Only Scans depend on a fresh visibility map.
- **Archi (Architect):** if the read pattern expands to "last N orders across many users in one request" (e.g. an admin dashboard), revisit this strategy — a `LATERAL` join over a list of user IDs with the same composite index still works but benchmarks should be rerun.
