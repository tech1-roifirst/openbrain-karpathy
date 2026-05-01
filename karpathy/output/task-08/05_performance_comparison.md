# Task 08 / Deliverable 5: Performance Comparison

## 1. Side-by-side EXPLAIN plans

### BEFORE (no index)

```
Sort  (cost=12894.55..13069.55 rows=70000 width=120)
      (actual time=438.214..472.881 rows=70000 loops=1)
  Sort Key: e.date
  Sort Method: external merge  Disk: 9024kB
  Buffers: shared hit=2174, temp read=1128 written=1130
  ->  Seq Scan on public.events e
          (cost=0.00..3174.00 rows=70000 width=120)
          (actual time=0.038..71.402 rows=70000 loops=1)
        Filter: (e.date > now())
        Rows Removed by Filter: 30000
        Buffers: shared hit=2174
Planning Time:  0.184 ms
Execution Time: 498.643 ms
```

### AFTER (idx_events_future_dates partial B-tree)

```
Index Scan using idx_events_future_dates on public.events e
        (cost=0.29..2554.31 rows=70000 width=120)
        (actual time=0.052..14.318 rows=70000 loops=1)
  Index Cond: (e.date > now())
  Buffers: shared hit=2362
Planning Time:  0.241 ms
Execution Time: 18.764 ms
```

## 2. Plan-node delta

| Plan node | BEFORE | AFTER | Effect |
|---|---|---|---|
| Top-level node | `Sort` | `Index Scan` | Sort eliminated |
| Scan node | `Seq Scan` | `Index Scan` | No full table scan |
| Predicate location | `Filter` (post-scan) | `Index Cond` (in-descent) | No wasted work |
| Rows discarded | 30,000 | 0 | Past rows never touched |
| Sort method | external merge (disk spill) | none | Temp files gone |
| Temp I/O | read 1,128 / written 1,130 (8KB pages) | 0 | ~9 MB of disk I/O removed |

## 3. Metrics table

| Metric                | BEFORE        | AFTER         | Delta      | Target         |
|-----------------------|---------------|---------------|------------|----------------|
| Execution time        | ~498 ms       | ~19 ms        | **-26x**   | <= 100 ms      |
| Planning time         | 0.18 ms       | 0.24 ms       | +0.06 ms   | n/a            |
| Total cost (planner)  | 13,069.55     | 2,554.31      | -5.1x      | n/a            |
| Rows scanned          | 100,000       | ~70,000       | -30k rows  | "less"         |
| Rows returned         | 70,000        | 70,000        | identical  | identical      |
| Heap pages touched    | 2,174         | 2,362         | +188       | acceptable     |
| Temp file I/O         | 9 MB          | 0             | -9 MB      | none           |
| Scan type             | Seq Scan      | Index Scan    | win        | Index Scan     |
| Sort node             | yes (disk)    | none          | win        | none           |
| Index size on disk    | n/a           | ~2 MB         | +2 MB      | < 50 MB        |
| Write latency overhead| n/a           | +0.1-0.3 ms   | minor      | +0.2-0.5 ms OK |

The +188 heap pages in the AFTER plan are explained below in section 5.

## 4. Visual representation

```
Execution time (ms, lower is better)
BEFORE  |##############################################################  498 ms
AFTER   |##                                                                19 ms
                                                                          ^
                                                                          5x target line at 100 ms

Total planner cost (lower is better)
BEFORE  |##########################################################   13,069
AFTER   |###########                                                    2,554

Temp disk I/O (KB, lower is better)
BEFORE  |#################                                              9,024 KB
AFTER   |                                                                   0 KB
```

## 5. Why the improvement occurred

### 5a. The Sort disappears

A B-tree index stores leaf entries in key order. A forward Index Scan
returns rows in `date ASC` order with no extra work. The original plan
spent ~350-400 ms in the external-merge sort -- that entire phase is
gone.

### 5b. The full scan disappears

`Index Cond: (e.date > now())` means PostgreSQL descends the B-tree to
the first key > now() and walks leaf entries forward. Past-event index
entries (and their underlying rows) are never visited. We replaced a
linear-in-table scan with a logarithmic descent + sequential leaf walk.

### 5c. Why heap-page hits are slightly higher (+188 pages)

Counter-intuitively, the optimized plan reads slightly MORE heap pages
in `shared hit` than the Seq Scan did. Reason: the Seq Scan reads each
heap page exactly once and processes all rows on it (including the 30%
past-event rows we don't want). The Index Scan visits the heap once per
matching row, and matching rows can be scattered across pages -- some
pages get visited multiple times if multiple matched rows live there,
or a page may be touched even though only some of its rows match.
Net effect: marginally more buffer hits, but ZERO disk reads vs. the
original's 9 MB of temp file I/O. This is a normal pattern and does not
indicate a problem.

If the heap-fetch overhead ever becomes a real cost, the answer is a
covering index with `INCLUDE (...)` to enable Index-Only Scans -- see
`06_advanced_options.md`.

### 5d. Selectivity is high but the plan still wins

70% selectivity is ordinarily a marginal case for B-tree indexes -- the
heap-fetch overhead can rival a Seq Scan. The decisive factor here is
the `ORDER BY date ASC`. Even at 100% selectivity, an Index Scan that
returns sorted rows beats Seq Scan + Sort because it eliminates a full
sort of 70k rows that spills to disk.

## 6. Did we hit the brief's success criteria?

| Criterion | Met? | Evidence |
|---|---|---|
| Same result set, same order | yes | identical projection and `ORDER BY` |
| Index Scan in plan (not Seq Scan) | yes | top scan node is `Index Scan` |
| 5x speedup, < 100 ms | yes | ~26x speedup, 19 ms execution |
| Documented index strategy & trade-offs | yes | files 02, 03, 06 |
| Before/after EXPLAIN ANALYZE | yes | this file + 01 + 04 |
| Explained why the improvement occurred | yes | section 5 above |
| Storage and write costs addressed | yes | section 3 + file 02 |
| Monitoring & maintenance | yes | file 08 |
