/**
 * Structured JSON logger with stdout + file sinks.
 *
 * - Every entry is a single line of JSON (parseable by log aggregators).
 * - Sensitive fields are redacted at write time.
 * - File writes are append-only and best-effort: a logger failure must
 *   never crash the pipeline.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { LogEntry, LogLevel, PipelinePhase } from '../types/pipeline.js';

const REDACT_KEYS = new Set(['password', 'token', 'secret', 'authorization', 'cookie']);

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v);
    }
    return out;
  }
  return value;
}

export interface LoggerOptions {
  /** Path to log file. If undefined, no file sink is attached. */
  logFile?: string;
  /** If false, suppress stdout output (useful in tests). Default: true. */
  stdout?: boolean;
  /** Minimum level to emit. Default: 'info' (or 'debug' if LOG_LEVEL=debug). */
  minLevel?: LogLevel;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  private readonly logFile?: string;
  private readonly stdout: boolean;
  private readonly minLevel: LogLevel;
  private readonly buffer: LogEntry[] = [];
  private fileReady: Promise<void>;

  constructor(opts: LoggerOptions = {}) {
    this.logFile = opts.logFile;
    this.stdout = opts.stdout ?? true;
    this.minLevel =
      opts.minLevel ??
      ((process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info');

    this.fileReady = this.logFile
      ? fs.mkdir(path.dirname(this.logFile), { recursive: true }).then(() => undefined)
      : Promise.resolve();
  }

  /** Returns a copy of all log entries written this session — useful in tests. */
  getEntries(): LogEntry[] {
    return [...this.buffer];
  }

  info(message: string, metadata?: Record<string, unknown>, phase?: PipelinePhase | 'orchestrator'): void {
    void this.log('info', message, metadata, phase);
  }

  warn(message: string, metadata?: Record<string, unknown>, phase?: PipelinePhase | 'orchestrator'): void {
    void this.log('warn', message, metadata, phase);
  }

  error(message: string, metadata?: Record<string, unknown>, phase?: PipelinePhase | 'orchestrator'): void {
    void this.log('error', message, metadata, phase);
  }

  debug(message: string, metadata?: Record<string, unknown>, phase?: PipelinePhase | 'orchestrator'): void {
    void this.log('debug', message, metadata, phase);
  }

  private async log(
    level: LogLevel,
    message: string,
    metadata: Record<string, unknown> | undefined,
    phase: PipelinePhase | 'orchestrator' | undefined,
  ): Promise<void> {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...(phase ? { phase } : {}),
      message,
      ...(metadata ? { metadata: redact(metadata) as Record<string, unknown> } : {}),
    };

    this.buffer.push(entry);

    let line: string;
    try {
      line = JSON.stringify(entry);
    } catch {
      line = JSON.stringify({
        timestamp: entry.timestamp,
        level: 'error',
        message: 'Log serialization failed',
      });
    }

    if (this.stdout) {
      const stream = level === 'error' ? process.stderr : process.stdout;
      stream.write(line + '\n');
    }

    if (this.logFile) {
      try {
        await this.fileReady;
        await fs.appendFile(this.logFile, line + '\n', 'utf8');
      } catch {
        // File logging must not crash the pipeline.
      }
    }
  }
}

/** A no-op logger — used by tests to keep stdout clean. */
export class SilentLogger extends Logger {
  constructor() {
    super({ stdout: false });
  }
}
