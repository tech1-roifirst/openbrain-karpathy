# Task 9: Data Pipeline (ETL)

**Agent:** joey-fullstack-backend

**Objective:** Build a data pipeline that extracts, transforms, and loads data robustly with error handling and idempotency.

---

## Input Specification

**Requirement:** Build a daily pipeline that:
1. Fetches new events from an external API (mock endpoint: GET /api/events?since=<timestamp>)
2. Transforms: normalize dates, validate fields, enrich with location data
3. Loads into database (events table)
4. Handles failures gracefully (retries on timeout, API errors)
5. Ensures idempotency (re-running doesn't create duplicates)
6. Logs all execution (start, end, rows processed, errors)

---

## Output Specification

Generate a TypeScript/JavaScript pipeline script that:
- ✅ Fetches data from mock API with error handling
- ✅ Transforms each record (normalize dates, validate required fields)
- ✅ Loads into database (upsert pattern for idempotency)
- ✅ Handles API timeouts (retries 3 times with exponential backoff)
- ✅ Handles validation errors (logs error, continues with next record)
- ✅ Structured logging: timestamp, status, row count, error details
- ✅ Transaction support (all-or-nothing per batch, or log failures individually)

---

## Success Criteria

- ✅ Compiles without errors
- ✅ Passes integration tests:
  1. Fetches data from mock API successfully
  2. Transforms records correctly (dates normalized, fields validated)
  3. Loads into database without errors
  4. Handles API timeout gracefully (logs error, continues)
  5. Handles invalid record gracefully (logs, skips, continues)
  6. Re-running doesn't create duplicates (idempotency via upsert)
  7. All records logged with count (e.g., "Processed 1000 records, 5 errors, 995 inserted")
- ✅ Execution time < 5 minutes for 1000 records
- ✅ Logs are structured and parseable (JSON or key=value format)

---

## Notes

- Use async/await for all I/O operations
- Implement exponential backoff for retries (1s, 2s, 4s, then fail)
- Assume events table schema: id (UUID), name, date, location, etc.
- Use upsert (INSERT ... ON CONFLICT) to handle duplicates
- Log to stdout/file (not error streams for non-fatal errors)
- Idempotency key: use external event_id as dedup key
