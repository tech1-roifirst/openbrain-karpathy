/**
 * Events API client.
 *
 * Responsibilities:
 *   - Fetch paginated event batches from `GET /api/events?since=...`
 *   - Classify failures (timeout, 4xx, 5xx, network)
 *   - Retry transient failures with exponential backoff
 *   - Surface a non-retryable error after final attempt
 *
 * Design notes:
 *   - 4xx is non-retryable by spec — we log and skip the batch.
 *   - 5xx, timeout, and network errors are retryable up to `retries` times.
 *   - Pagination yields batches lazily so the orchestrator can stream.
 */

import type { EventsApiResponse, ErrorCode, PipelineConfig } from '../types/pipeline.js';
import type { Logger } from './logger.js';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Minimal fetch shape — keeps us decoupled from any specific http lib. */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

export interface EventApiClientOptions {
  config: PipelineConfig['api'];
  logger: Logger;
  /** Inject for tests. Defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Inject for deterministic backoff in tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class EventApiClient {
  private readonly cfg: PipelineConfig['api'];
  private readonly logger: Logger;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: EventApiClientOptions) {
    this.cfg = opts.config;
    this.logger = opts.logger;
    this.fetchImpl = opts.fetchImpl ?? ((globalThis as unknown as { fetch: FetchLike }).fetch);
    this.sleep = opts.sleep ?? defaultSleep;
  }

  /**
   * Stream event batches across all pages.
   * Yields one page per iteration; throws ApiError if the upstream is unrecoverable.
   */
  async *fetchEvents(since: Date): AsyncGenerator<EventsApiResponse, void, void> {
    let cursor: string | null = null;
    let page = 0;
    do {
      page += 1;
      const url = this.buildUrl(since, cursor);
      const response = await this.fetchWithRetry(url, page);
      yield response;
      cursor = response.nextPage;
    } while (cursor !== null);
  }

  private buildUrl(since: Date, cursor: string | null): string {
    const params = new URLSearchParams({ since: since.toISOString() });
    if (cursor) params.set('page', cursor);
    return `${this.cfg.baseUrl}/events?${params.toString()}`;
  }

  /** Execute a single GET with retry/backoff & error classification. */
  private async fetchWithRetry(url: string, page: number): Promise<EventsApiResponse> {
    let attempt = 0;
    let lastError: ApiError | null = null;

    while (attempt <= this.cfg.retries) {
      const start = Date.now();
      try {
        const response = await this.fetchOnce(url);
        this.logger.info(
          'API page fetched',
          { url, page, attempt: attempt + 1, durationMs: Date.now() - start, recordsFetched: response.events.length },
          'extract',
        );
        return response;
      } catch (err) {
        const apiErr = this.toApiError(err);
        lastError = apiErr;

        if (!apiErr.retryable || attempt >= this.cfg.retries) {
          this.logger.error(
            'API request failed (final)',
            { url, page, attempt: attempt + 1, errorCode: apiErr.code, status: apiErr.status, error: apiErr.message },
            'extract',
          );
          throw apiErr;
        }

        const wait = this.cfg.backoffBaseMs * this.cfg.backoffMultiplier ** attempt;
        this.logger.warn(
          'API request failed — retrying',
          {
            url, page, attempt: attempt + 1, retryCount: attempt + 1,
            retryReason: apiErr.code, waitMs: wait, error: apiErr.message,
          },
          'extract',
        );
        await this.sleep(wait);
        attempt += 1;
      }
    }

    /* istanbul ignore next — defensive, while-loop always throws or returns above. */
    throw lastError ?? new ApiError('Exhausted retries with no error captured', 'UNKNOWN', undefined, false);
  }

  /** A single HTTP attempt with timeout + status classification. */
  private async fetchOnce(url: string): Promise<EventsApiResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal });
      if (res.ok) {
        const body = (await res.json()) as EventsApiResponse;
        if (!body || !Array.isArray(body.events)) {
          throw new ApiError('Malformed API response — `events` is not an array', 'PARSE_ERROR', res.status, false);
        }
        return body;
      }
      if (res.status >= 500) {
        throw new ApiError(`Upstream 5xx: ${res.status} ${res.statusText}`, 'API_5XX', res.status, true);
      }
      if (res.status >= 400) {
        throw new ApiError(`Upstream 4xx: ${res.status} ${res.statusText}`, 'API_4XX', res.status, false);
      }
      throw new ApiError(`Unexpected status ${res.status}`, 'UNKNOWN', res.status, false);
    } finally {
      clearTimeout(timer);
    }
  }

  private toApiError(err: unknown): ApiError {
    if (err instanceof ApiError) return err;
    const message = err instanceof Error ? err.message : String(err);
    // AbortError indicates our own timeout fired.
    if (err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message))) {
      return new ApiError(`Request timed out after ${this.cfg.timeoutMs}ms`, 'API_TIMEOUT', undefined, true);
    }
    return new ApiError(`Network error: ${message}`, 'NETWORK_ERROR', undefined, true);
  }
}
