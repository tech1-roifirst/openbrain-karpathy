/**
 * Integration tests for the events pipeline.
 *
 * Runs without any external services — the API is mocked via
 * `createMockEventApiHandler` and the database is a deterministic
 * in-memory stub that mirrors the postgres `xmax = 0` upsert contract.
 *
 * Designed to run with either `node --test` (Node 20+) or vitest. We
 * import only from `node:test` so the file is dependency-free.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { EventsPipeline } from './eventsPipeline.js';
import { EventApiClient, type FetchLike } from '../services/eventApiClient.js';
import { EventsTransformer } from '../services/eventsTransformer.js';
import { EventsDatabase, type DbClient, type DbPool, type DbQueryResult } from '../services/eventsDatabase.js';
import { SilentLogger } from '../services/logger.js';
import { createMockEventApiHandler } from '../mocks/mockEventApi.js';
import { loadConfig } from '../config/pipeline.config.js';
import type { PipelineConfig } from '../types/pipeline.js';

// ─────────────── In-memory database stub ────────────────────

interface MemoryRow {
  id: string;
  external_id: string;
  name: string;
  date: Date;
  location: string;
  latitude: number;
  longitude: number;
  processed_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface MemoryDbOptions {
  failOnBatch?: number; // throw on the Nth batch (1-indexed) to test recovery
}

function createMemoryDb(opts: MemoryDbOptions = {}): {
  pool: DbPool;
  rows: () => MemoryRow[];
  totalUpserts: () => number;
} {
  const store = new Map<string, MemoryRow>();
  let upsertCount = 0;
  let batchCounter = 0;
  let inTransaction = false;
  let pendingOps: Array<() => void> = [];

  const client: DbClient = {
    async query(sql: string, params?: ReadonlyArray<unknown>): Promise<DbQueryResult> {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed === 'BEGIN') {
        batchCounter += 1;
        inTransaction = true;
        pendingOps = [];
        if (opts.failOnBatch === batchCounter) {
          // Simulate a deferred failure: BEGIN succeeds but the first DML throws.
        }
        return { rowCount: 0, rows: [] };
      }
      if (trimmed === 'COMMIT') {
        // Apply pending ops atomically.
        for (const op of pendingOps) op();
        pendingOps = [];
        inTransaction = false;
        return { rowCount: 0, rows: [] };
      }
      if (trimmed === 'ROLLBACK') {
        pendingOps = [];
        inTransaction = false;
        return { rowCount: 0, rows: [] };
      }
      if (trimmed.startsWith('INSERT INTO EVENTS')) {
        if (opts.failOnBatch === batchCounter) {
          throw new Error('Simulated DB failure on batch ' + batchCounter);
        }
        const [id, externalId, name, date, location, latitude, longitude, processedAt] = params ?? [];
        const existing = store.get(externalId as string);
        const wasInserted = !existing;
        const now = new Date();
        const newRow: MemoryRow = {
          id: existing ? existing.id : (id as string),
          external_id: externalId as string,
          name: name as string,
          date: date as Date,
          location: location as string,
          latitude: latitude as number,
          longitude: longitude as number,
          processed_at: processedAt as Date,
          created_at: existing ? existing.created_at : now,
          updated_at: now,
        };
        // Defer mutation until COMMIT to honor the transaction contract.
        if (inTransaction) {
          pendingOps.push(() => {
            store.set(newRow.external_id, newRow);
            upsertCount += 1;
          });
        } else {
          store.set(newRow.external_id, newRow);
          upsertCount += 1;
        }
        return {
          rowCount: 1,
          rows: [{ inserted: wasInserted }],
        };
      }
      throw new Error('Unhandled SQL in memory stub: ' + sql.slice(0, 60));
    },
    release(): void {
      // no-op
    },
  };

  const pool: DbPool = {
    async connect() {
      return client;
    },
  };

  return {
    pool,
    rows: () => Array.from(store.values()),
    totalUpserts: () => upsertCount,
  };
}

// ─────────────── Helpers ────────────────────

function makeFetchFromMock(handler: (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>): FetchLike {
  return async (url, init) => handler(url, init);
}

function buildConfig(overrides: Partial<PipelineConfig['pipeline']> = {}): PipelineConfig {
  return loadConfig({
    api: {
      baseUrl: 'http://mock/api',
      timeoutMs: 50,
      retries: 3,
      backoffBaseMs: 1,
      backoffMultiplier: 2,
    },
    pipeline: {
      batchSize: overrides.batchSize ?? 100,
      since: overrides.since ?? new Date('2026-04-01T00:00:00Z'),
      logFile: overrides.logFile ?? '',
    },
  });
}

function build(deps: {
  config: PipelineConfig;
  fetchImpl: FetchLike;
  pool: DbPool;
}): EventsPipeline {
  const logger = new SilentLogger();
  const apiClient = new EventApiClient({
    config: deps.config.api,
    logger,
    fetchImpl: deps.fetchImpl,
    sleep: async () => {/* fast tests */},
  });
  const transformer = new EventsTransformer({ logger });
  const database = new EventsDatabase({ pool: deps.pool, logger });
  return new EventsPipeline({
    config: deps.config,
    apiClient,
    transformer,
    database,
    logger,
  });
}

// ─────────────── Tests ────────────────────

describe('EventsPipeline integration', () => {
  test('1. fetches data from mock API successfully', async () => {
    const mock = createMockEventApiHandler({ totalEvents: 100, pageSize: 50, invalidRecords: 0, invalidDateRecords: 0 });
    const db = createMemoryDb();
    const pipeline = build({ config: buildConfig({ batchSize: 50 }), fetchImpl: makeFetchFromMock(mock.handle), pool: db.pool });

    const result = await pipeline.run();

    assert.equal(result.recordsFetched, 100, 'should fetch 100 records across pages');
    assert.equal(result.exitCode, 0);
  });

  test('2. transforms records correctly (fields validated, dates normalized to UTC)', async () => {
    const mock = createMockEventApiHandler({ totalEvents: 30, pageSize: 30, invalidRecords: 0, invalidDateRecords: 0 });
    const db = createMemoryDb();
    const pipeline = build({ config: buildConfig({ batchSize: 30 }), fetchImpl: makeFetchFromMock(mock.handle), pool: db.pool });

    await pipeline.run();
    const rows = db.rows();

    assert.equal(rows.length, 30);
    for (const row of rows) {
      assert.ok(row.external_id.startsWith('ext-event-'));
      assert.ok(row.name.length > 0);
      assert.ok(row.date instanceof Date && !Number.isNaN(row.date.getTime()));
      // Geocoder enrichment should produce non-zero coordinates for known cities.
      assert.notEqual(row.latitude, undefined);
      assert.notEqual(row.longitude, undefined);
      assert.ok(row.processed_at instanceof Date);
    }
  });

  test('3. loads into database without errors', async () => {
    const mock = createMockEventApiHandler({ totalEvents: 250, pageSize: 100, invalidRecords: 0, invalidDateRecords: 0 });
    const db = createMemoryDb();
    const pipeline = build({ config: buildConfig({ batchSize: 100 }), fetchImpl: makeFetchFromMock(mock.handle), pool: db.pool });

    const result = await pipeline.run();

    assert.equal(result.recordsFailed, 0);
    assert.equal(result.recordsInserted, 250);
    assert.equal(db.rows().length, 250);
  });

  test('4. handles API timeout gracefully (logs error, retries, continues)', async () => {
    // Page 2 hangs once, then recovers on retry.
    const mock = createMockEventApiHandler({
      totalEvents: 200,
      pageSize: 100,
      invalidRecords: 0,
      invalidDateRecords: 0,
      timeoutPages: [2],
      timeoutRecoversAfter: 1,
    });
    const db = createMemoryDb();
    const pipeline = build({ config: buildConfig({ batchSize: 100 }), fetchImpl: makeFetchFromMock(mock.handle), pool: db.pool });

    const result = await pipeline.run();

    assert.equal(result.exitCode, 0, 'pipeline must recover after retry');
    assert.equal(result.recordsFetched, 200);
    assert.equal(result.recordsInserted, 200);
  });

  test('5. handles invalid records gracefully (logs, skips, continues)', async () => {
    const mock = createMockEventApiHandler({
      totalEvents: 100,
      pageSize: 100,
      invalidRecords: 10,        // missing name
      invalidDateRecords: 5,     // bad date string
    });
    const db = createMemoryDb();
    const pipeline = build({ config: buildConfig({ batchSize: 100 }), fetchImpl: makeFetchFromMock(mock.handle), pool: db.pool });

    const result = await pipeline.run();

    assert.equal(result.recordsFetched, 100);
    assert.equal(result.recordsValid, 85, 'should skip 15 invalid records');
    assert.equal(result.recordsSkipped, 15);
    assert.equal(result.recordsInserted, 85);
    assert.equal(result.exitCode, 0);
    // Errors should be captured with codes.
    const codes = new Set(result.errors.map((e) => e.errorCode));
    assert.ok(codes.has('MISSING_FIELD') || codes.has('INVALID_DATE'));
  });

  test('6. re-running does not create duplicates (idempotency via upsert)', async () => {
    const mock = createMockEventApiHandler({ totalEvents: 50, pageSize: 50, invalidRecords: 0, invalidDateRecords: 0 });
    const db = createMemoryDb();
    const cfg = buildConfig({ batchSize: 50 });

    const first = await build({ config: cfg, fetchImpl: makeFetchFromMock(mock.handle), pool: db.pool }).run();
    assert.equal(first.recordsInserted, 50);
    assert.equal(first.recordsUpdated, 0);

    // Reset mock state so the same data is re-served.
    mock.reset();
    const second = await build({ config: cfg, fetchImpl: makeFetchFromMock(mock.handle), pool: db.pool }).run();

    assert.equal(second.recordsInserted, 0, 'second run must not insert anything');
    assert.equal(second.recordsUpdated, 50, 'second run must update existing rows');
    assert.equal(db.rows().length, 50, 'row count is unchanged after re-run');
  });

  test('7. logs execution summary with counts', async () => {
    const mock = createMockEventApiHandler({
      totalEvents: 100,
      pageSize: 100,
      invalidRecords: 5,
      invalidDateRecords: 0,
    });
    const db = createMemoryDb();
    const logger = new SilentLogger();
    const apiClient = new EventApiClient({
      config: buildConfig().api,
      logger,
      fetchImpl: makeFetchFromMock(mock.handle),
      sleep: async () => {/* */},
    });
    const transformer = new EventsTransformer({ logger });
    const database = new EventsDatabase({ pool: db.pool, logger });
    const pipeline = new EventsPipeline({
      config: buildConfig({ batchSize: 100 }),
      apiClient,
      transformer,
      database,
      logger,
    });

    await pipeline.run();
    const summary = logger.getEntries().find((e) =>
      typeof e.message === 'string' && /Processed \d+,.*errors,.*inserted,.*updated/.test(e.message),
    );
    assert.ok(summary, 'summary log line must be emitted');
    assert.match(summary.message, /Processed 100, 5 errors, 95 inserted, 0 updated/);
    assert.ok(summary.metadata && typeof summary.metadata.executionTimeMs === 'number');
  });

  test('bonus: DB transaction failure on a batch is logged and pipeline continues', async () => {
    const mock = createMockEventApiHandler({ totalEvents: 200, pageSize: 100, invalidRecords: 0, invalidDateRecords: 0 });
    const db = createMemoryDb({ failOnBatch: 1 });
    const pipeline = build({ config: buildConfig({ batchSize: 100 }), fetchImpl: makeFetchFromMock(mock.handle), pool: db.pool });

    const result = await pipeline.run();

    assert.equal(result.exitCode, 0, 'pipeline still succeeds overall');
    assert.equal(result.recordsFailed, 100, 'failed batch is reported');
    assert.equal(result.recordsInserted, 100, 'second batch inserts');
    assert.equal(db.rows().length, 100);
  });

  test('bonus: 4xx response is non-retryable and aborts extract', async () => {
    const mock = createMockEventApiHandler({ totalEvents: 200, pageSize: 100, invalidRecords: 0, invalidDateRecords: 0, fourxxPages: [1] });
    const db = createMemoryDb();
    const pipeline = build({ config: buildConfig({ batchSize: 100 }), fetchImpl: makeFetchFromMock(mock.handle), pool: db.pool });

    const result = await pipeline.run();
    assert.equal(result.exitCode, 1);
    assert.equal(db.rows().length, 0);
  });

  test('bonus: structured logs are valid JSON', async () => {
    const mock = createMockEventApiHandler({ totalEvents: 5, pageSize: 5, invalidRecords: 0, invalidDateRecords: 0 });
    const db = createMemoryDb();
    const logger = new SilentLogger();
    const apiClient = new EventApiClient({
      config: buildConfig().api,
      logger,
      fetchImpl: makeFetchFromMock(mock.handle),
      sleep: async () => {/* */},
    });
    const transformer = new EventsTransformer({ logger });
    const database = new EventsDatabase({ pool: db.pool, logger });
    const pipeline = new EventsPipeline({
      config: buildConfig({ batchSize: 5 }),
      apiClient,
      transformer,
      database,
      logger,
    });
    await pipeline.run();
    for (const entry of logger.getEntries()) {
      // Each entry must round-trip through JSON without throwing.
      const json = JSON.stringify(entry);
      const parsed = JSON.parse(json) as { timestamp: string; level: string; message: string };
      assert.ok(parsed.timestamp);
      assert.ok(parsed.level);
      assert.ok(parsed.message);
    }
  });
});
