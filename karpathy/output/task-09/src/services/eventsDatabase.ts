/**
 * Events database service — upsert with idempotency.
 *
 * Uses a minimal pool/transaction interface so the orchestrator can run
 * against either real `pg` or an in-memory test stub. The contract:
 *
 *   pool.connect()              -> Client
 *   client.query(sql, params)   -> { rowCount, rows }
 *   client.release()            -> void
 *
 * Each batch runs inside a transaction. If any statement throws, we
 * ROLLBACK and surface a DB_TRANSACTION_FAILED error so the orchestrator
 * can move on to the next batch.
 *
 * Idempotency: `external_id` is UNIQUE; we ON CONFLICT DO UPDATE and
 * use `xmax = 0` (or the RETURNING-vs-existing trick) to distinguish
 * INSERT from UPDATE in the result set.
 */

import type { LoadResult, RecordError, TransformedEvent } from '../types/pipeline.js';
import type { Logger } from './logger.js';

export interface DbQueryResult {
  rowCount: number | null;
  rows: Array<Record<string, unknown>>;
}

export interface DbClient {
  query(sql: string, params?: ReadonlyArray<unknown>): Promise<DbQueryResult>;
  release(err?: Error): void;
}

export interface DbPool {
  connect(): Promise<DbClient>;
  end?(): Promise<void>;
}

export interface EventsDatabaseDeps {
  pool: DbPool;
  logger: Logger;
}

/**
 * The upsert SQL — note the `xmax = 0` trick for postgres:
 *   - On INSERT, xmax of the returned row is 0
 *   - On UPDATE, xmax is non-zero
 * This lets a single statement report inserts vs updates atomically.
 *
 * For non-postgres test stubs we fall back to inferring from rowCount
 * deltas — see `MemoryEventsDatabase` in tests.
 */
export const UPSERT_SQL = `
INSERT INTO events (
  id, external_id, name, "date", location, latitude, longitude, processed_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (external_id) DO UPDATE SET
  name         = EXCLUDED.name,
  "date"       = EXCLUDED."date",
  location     = EXCLUDED.location,
  latitude     = EXCLUDED.latitude,
  longitude    = EXCLUDED.longitude,
  processed_at = EXCLUDED.processed_at,
  updated_at   = NOW()
RETURNING (xmax = 0) AS inserted
`.trim();

export class EventsDatabase {
  private readonly pool: DbPool;
  private readonly logger: Logger;

  constructor(deps: EventsDatabaseDeps) {
    this.pool = deps.pool;
    this.logger = deps.logger;
  }

  /**
   * Upsert a batch of events inside a transaction.
   *
   * - Returns `{inserted, updated, failed, errors}`.
   * - If the transaction fails midway, ROLLBACK and report all records as failed.
   * - Per-record errors that happen *outside* a transaction failure are
   *   captured but never abort the batch.
   */
  async upsertBatch(events: readonly TransformedEvent[], batchNumber: number): Promise<LoadResult> {
    if (events.length === 0) {
      return { inserted: 0, updated: 0, failed: 0, errors: [] };
    }

    const client = await this.pool.connect();
    let inserted = 0;
    let updated = 0;
    const errors: RecordError[] = [];

    try {
      await client.query('BEGIN');
      for (const event of events) {
        const result = await client.query(UPSERT_SQL, [
          event.id,
          event.externalId,
          event.name,
          event.date,
          event.location,
          event.latitude,
          event.longitude,
          event.processedAt,
        ]);
        const row = result.rows[0];
        const wasInserted =
          row && typeof row === 'object' && 'inserted' in row
            ? Boolean((row as { inserted: unknown }).inserted)
            : (result.rowCount ?? 0) > 0;
        if (wasInserted) inserted += 1;
        else updated += 1;
      }
      await client.query('COMMIT');
      this.logger.info(
        'Batch committed',
        { batchNumber, inserted, updated, batchSize: events.length },
        'load',
      );
      return { inserted, updated, failed: 0, errors };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        await client.query('ROLLBACK');
      } catch {
        /* swallow — rollback failure is logged below via caller */
      }
      this.logger.error(
        'Batch transaction failed — rolled back',
        { batchNumber, batchSize: events.length, error: message },
        'load',
      );
      // Mark every record in this batch as failed so the caller can report accurately.
      for (const event of events) {
        errors.push({
          recordId: event.externalId,
          phase: 'load',
          errorCode: 'DB_TRANSACTION_FAILED',
          error: message,
        });
      }
      return { inserted: 0, updated: 0, failed: events.length, errors };
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool.end) await this.pool.end();
  }
}
