# Task 09 — Events ETL Pipeline

A production-grade Extract → Transform → Load pipeline written in strict TypeScript.

## Layout

```
task-09/
├── package.json
├── tsconfig.json
├── schema.sql                     -- Postgres DDL with UNIQUE(external_id)
├── src/
│   ├── config/pipeline.config.ts  -- env + CLI config loader
│   ├── types/pipeline.ts          -- shared type definitions
│   ├── services/
│   │   ├── logger.ts              -- structured JSON logger (stdout + file)
│   │   ├── eventApiClient.ts      -- API client w/ retries + classification
│   │   ├── eventsTransformer.ts   -- validation + enrichment
│   │   └── eventsDatabase.ts      -- transactional upsert (ON CONFLICT)
│   ├── pipeline/
│   │   ├── eventsPipeline.ts      -- orchestrator
│   │   ├── runPipeline.ts         -- CLI entry point
│   │   └── eventsPipeline.test.ts -- 7 integration tests + 3 bonus
│   └── mocks/mockEventApi.ts      -- env-controllable mock API
└── logs/pipeline.log              -- created on first run
```

## Run

```bash
# Install (pg is optional; only needed for real DB runs)
npm install

# Type-check the project
npm run typecheck

# Run integration tests (no DB or network required)
npm run test:dev

# Run the pipeline against a real Postgres + API
npm run pipeline:dev -- --since 2026-04-29T00:00:00Z --batch-size 100
```

## Architecture decisions

* **Streaming over buffering.** `fetchEvents` is an `AsyncGenerator`, so memory stays
  bounded regardless of total page count.
* **Idempotency via DB.** `ON CONFLICT (external_id) DO UPDATE` plus the
  `xmax = 0` trick (Postgres) lets a single statement report inserts vs updates atomically.
* **Failures are typed.** `ApiError` carries an `errorCode` discriminator
  (`API_TIMEOUT`, `API_4XX`, `API_5XX`, `NETWORK_ERROR`) and a `retryable` flag — the
  retry policy reads off these, not off message strings.
* **Logger never crashes the pipeline.** File-write errors are swallowed; serialization
  failures fall back to a minimal record.
* **Dependency injection everywhere.** `fetchImpl`, `now`, `uuid`, `sleep` and the DB
  pool are all injectable, which keeps the test suite hermetic and < 1s.

## Success criteria checklist

| # | Criterion                                        | Test |
|---|--------------------------------------------------|------|
| 1 | Fetches data from mock API                       | `eventsPipeline.test.ts` test 1 |
| 2 | Transforms records correctly                     | test 2 |
| 3 | Loads into database without errors               | test 3 |
| 4 | Handles API timeout (logs, retries, continues)   | test 4 |
| 5 | Handles invalid records (logs, skips, continues) | test 5 |
| 6 | Re-running does not duplicate (upsert)           | test 6 |
| 7 | Logs execution summary with counts               | test 7 |

Plus three hardening tests for transaction failures, 4xx handling, and JSON-validity of every log line.
