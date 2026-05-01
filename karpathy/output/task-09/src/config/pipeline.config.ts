/**
 * Pipeline configuration.
 *
 * Loads from environment with safe defaults for local development.
 * Secrets (DB password) are NEVER hardcoded — they come from the env.
 */

import type { PipelineConfig } from '../types/pipeline.js';

function intFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function dateFromEnv(key: string, fallback: Date): Date {
  const raw = process.env[key];
  if (!raw) return fallback;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** Build a config object from process.env + per-call overrides. */
export function loadConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const base: PipelineConfig = {
    api: {
      baseUrl: process.env.EVENTS_API_BASE_URL ?? 'http://localhost:3000/api',
      timeoutMs: intFromEnv('EVENTS_API_TIMEOUT_MS', 30_000),
      retries: intFromEnv('EVENTS_API_RETRIES', 3),
      backoffBaseMs: intFromEnv('EVENTS_API_BACKOFF_BASE_MS', 1_000),
      backoffMultiplier: intFromEnv('EVENTS_API_BACKOFF_MULTIPLIER', 2),
    },
    database: {
      host: process.env.DB_HOST ?? 'localhost',
      port: intFromEnv('DB_PORT', 5432),
      database: process.env.DB_NAME ?? 'events_db',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD,
      poolSize: intFromEnv('DB_POOL_SIZE', 10),
    },
    pipeline: {
      batchSize: intFromEnv('PIPELINE_BATCH_SIZE', 100),
      since: dateFromEnv('PIPELINE_SINCE', oneDayAgo),
      logFile: process.env.PIPELINE_LOG_FILE ?? './logs/pipeline.log',
    },
  };

  return {
    api: { ...base.api, ...overrides.api },
    database: { ...base.database, ...overrides.database },
    pipeline: { ...base.pipeline, ...overrides.pipeline },
  };
}

/** Parse simple `--flag value` CLI args. */
export function parseCliArgs(argv: string[]): Partial<PipelineConfig> {
  const overrides: Partial<PipelineConfig> = {};
  const pipelineOverride: Partial<PipelineConfig['pipeline']> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--since' && next) {
      const d = new Date(next);
      if (!Number.isNaN(d.getTime())) pipelineOverride.since = d;
      i += 1;
    } else if (arg === '--batch-size' && next) {
      const n = Number.parseInt(next, 10);
      if (Number.isFinite(n) && n > 0) pipelineOverride.batchSize = n;
      i += 1;
    } else if (arg === '--log-file' && next) {
      pipelineOverride.logFile = next;
      i += 1;
    }
  }

  if (Object.keys(pipelineOverride).length > 0) {
    overrides.pipeline = pipelineOverride as PipelineConfig['pipeline'];
  }
  return overrides;
}
