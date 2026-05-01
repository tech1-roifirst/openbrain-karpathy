/**
 * Events pipeline orchestrator — extract → transform → load.
 *
 * Top-level loop:
 *   1. Stream pages from EventApiClient.fetchEvents(since).
 *   2. Buffer raw events; when buffer >= batchSize, flush a batch:
 *        a. transformer.transform(rawBatch)
 *        b. database.upsertBatch(validRecords)
 *   3. After all pages, flush any tail.
 *   4. Emit a single PipelineResult summary log line.
 *
 * Failure semantics:
 *   - API failure (after retries): log error, exit code 1.
 *   - Transform failure on a record: skip & log; pipeline continues.
 *   - DB transaction failure on a batch: log & continue with next batch.
 */

import type {
  PipelineConfig,
  PipelineResult,
  RawApiEvent,
  RecordError,
  TransformedEvent,
} from '../types/pipeline.js';
import type { EventApiClient } from '../services/eventApiClient.js';
import type { EventsTransformer } from '../services/eventsTransformer.js';
import type { EventsDatabase } from '../services/eventsDatabase.js';
import type { Logger } from '../services/logger.js';
import { ApiError } from '../services/eventApiClient.js';

export interface EventsPipelineDeps {
  config: PipelineConfig;
  apiClient: EventApiClient;
  transformer: EventsTransformer;
  database: EventsDatabase;
  logger: Logger;
}

export class EventsPipeline {
  private readonly cfg: PipelineConfig;
  private readonly api: EventApiClient;
  private readonly transformer: EventsTransformer;
  private readonly db: EventsDatabase;
  private readonly logger: Logger;

  constructor(deps: EventsPipelineDeps) {
    this.cfg = deps.config;
    this.api = deps.apiClient;
    this.transformer = deps.transformer;
    this.db = deps.database;
    this.logger = deps.logger;
  }

  async run(): Promise<PipelineResult> {
    const startedAt = new Date();
    const start = Date.now();
    this.logger.info(
      'Pipeline started',
      { since: this.cfg.pipeline.since.toISOString(), batchSize: this.cfg.pipeline.batchSize },
      'orchestrator',
    );

    let recordsFetched = 0;
    let recordsValid = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    let batchesProcessed = 0;
    const errors: RecordError[] = [];

    const rawBuffer: RawApiEvent[] = [];
    const flush = async (): Promise<void> => {
      if (rawBuffer.length === 0) return;
      batchesProcessed += 1;
      const batchNumber = batchesProcessed;
      const rawBatch = rawBuffer.splice(0, rawBuffer.length);

      const transformed = this.transformer.transform(rawBatch);
      recordsValid += transformed.valid.length;
      errors.push(...transformed.errors);

      const skippedInTransform = rawBatch.length - transformed.valid.length;
      if (skippedInTransform > 0) {
        this.logger.warn(
          'Records skipped in transform',
          { batchNumber, skipped: skippedInTransform, valid: transformed.valid.length },
          'transform',
        );
      }

      const validToLoad: TransformedEvent[] = transformed.valid;
      const loadResult = await this.db.upsertBatch(validToLoad, batchNumber);
      recordsInserted += loadResult.inserted;
      recordsUpdated += loadResult.updated;
      recordsFailed += loadResult.failed;
      errors.push(...loadResult.errors);

      this.logger.info(
        'Batch processed',
        {
          batchNumber,
          received: rawBatch.length,
          valid: transformed.valid.length,
          skipped: skippedInTransform,
          inserted: loadResult.inserted,
          updated: loadResult.updated,
          failed: loadResult.failed,
        },
        'orchestrator',
      );
    };

    try {
      for await (const page of this.api.fetchEvents(this.cfg.pipeline.since)) {
        recordsFetched += page.events.length;
        for (const event of page.events) {
          rawBuffer.push(event);
          if (rawBuffer.length >= this.cfg.pipeline.batchSize) {
            await flush();
          }
        }
      }
      await flush();
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        'Pipeline aborted — extract phase failed',
        {
          errorCode: apiErr?.code ?? 'UNKNOWN',
          status: apiErr?.status,
          error: message,
        },
        'orchestrator',
      );
      // Try to flush whatever we already buffered before aborting.
      try {
        await flush();
      } catch {
        /* nothing more we can do */
      }
      const finishedAt = new Date();
      const durationMs = Date.now() - start;
      const recordsSkipped = recordsFetched - recordsValid;
      const result: PipelineResult = {
        startedAt,
        finishedAt,
        durationMs,
        recordsFetched,
        recordsValid,
        recordsSkipped,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        batchesProcessed,
        errors,
        exitCode: 1,
      };
      this.logSummary(result);
      return result;
    }

    const finishedAt = new Date();
    const durationMs = Date.now() - start;
    const recordsSkipped = recordsFetched - recordsValid;
    const result: PipelineResult = {
      startedAt,
      finishedAt,
      durationMs,
      recordsFetched,
      recordsValid,
      recordsSkipped,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      batchesProcessed,
      errors,
      exitCode: 0,
    };
    this.logSummary(result);
    return result;
  }

  private logSummary(result: PipelineResult): void {
    const message = `Processed ${result.recordsFetched}, ${result.errors.length} errors, ${result.recordsInserted} inserted, ${result.recordsUpdated} updated`;
    this.logger.info(
      message,
      {
        startedAt: result.startedAt.toISOString(),
        finishedAt: result.finishedAt.toISOString(),
        executionTimeMs: result.durationMs,
        recordsFetched: result.recordsFetched,
        recordsValid: result.recordsValid,
        recordsSkipped: result.recordsSkipped,
        recordsInserted: result.recordsInserted,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        batchesProcessed: result.batchesProcessed,
        errorCount: result.errors.length,
        exitCode: result.exitCode,
        // Cap the inline error sample so summary lines stay grep-friendly.
        errorSample: result.errors.slice(0, 10).map((e) => ({
          recordId: e.recordId,
          phase: e.phase,
          errorCode: e.errorCode,
          error: e.error,
        })),
      },
      'orchestrator',
    );
  }
}
