/**
 * Type definitions for the events ETL pipeline.
 *
 * Authored by Joey (Fullstack Backend) — production-grade types with
 * strict null safety and discriminated unions for error categorization.
 */

// ───────────────────────────── API CONTRACT ─────────────────────────────

/** Raw event shape returned by the upstream `/api/events` endpoint. */
export interface RawApiEvent {
  id: string;
  name: string;
  date: string; // ISO 8601
  location: string;
}

/** Paginated response envelope from the upstream API. */
export interface EventsApiResponse {
  events: RawApiEvent[];
  /** Cursor for next page; `null` indicates last page. */
  nextPage: string | null;
}

// ─────────────────────────── DOMAIN / DATABASE ──────────────────────────

/** Validated, transformed, and enriched event ready for persistence. */
export interface TransformedEvent {
  /** Internal UUID, generated if upstream `id` is absent. */
  id: string;
  /** Upstream identifier — used as the idempotency key. */
  externalId: string;
  name: string;
  /** Normalized to UTC. */
  date: Date;
  location: string;
  latitude: number;
  longitude: number;
  processedAt: Date;
}

/** Database row representation (snake_case mirrors SQL columns). */
export interface EventDbRow {
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

// ───────────────────────────── ERRORS ─────────────────────────────

/** Categorized validation/transform error attached to a record. */
export interface RecordError {
  recordId: string;
  phase: PipelinePhase;
  errorCode: ErrorCode;
  error: string;
  field?: string;
}

export type ErrorCode =
  | 'MISSING_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_DATE'
  | 'PAST_DATE'
  | 'FIELD_TOO_LONG'
  | 'PARSE_ERROR'
  | 'ENRICHMENT_FAILED'
  | 'DB_INSERT_FAILED'
  | 'DB_TRANSACTION_FAILED'
  | 'API_TIMEOUT'
  | 'API_4XX'
  | 'API_5XX'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export type PipelinePhase = 'extract' | 'transform' | 'load';

// ────────────────────────── TRANSFORM RESULT ─────────────────────────────

export interface TransformResult {
  valid: TransformedEvent[];
  errors: RecordError[];
}

// ─────────────────────────── LOAD RESULT ─────────────────────────────

export interface LoadResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: RecordError[];
}

// ──────────────────────── PIPELINE EXECUTION ─────────────────────────────

export interface PipelineResult {
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  recordsFetched: number;
  recordsValid: number;
  recordsSkipped: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  batchesProcessed: number;
  errors: RecordError[];
  exitCode: 0 | 1;
}

// ───────────────────────────── LOGGING ─────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string; // ISO 8601
  level: LogLevel;
  phase?: PipelinePhase | 'orchestrator';
  message: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────── CONFIGURATION ───────────────────────────────

export interface PipelineConfig {
  api: {
    baseUrl: string;
    timeoutMs: number;
    retries: number;
    backoffBaseMs: number;
    backoffMultiplier: number;
  };
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string | undefined;
    poolSize: number;
  };
  pipeline: {
    batchSize: number;
    since: Date;
    logFile: string;
  };
}
