/**
 * Mock events API.
 *
 * Two surfaces:
 *
 *   1. `createMockEventApiHandler` — a framework-agnostic handler with the
 *      shape `(url) => Promise<MockResponse>`. Used directly by tests, and
 *      wrappable into Express via `mountMockEventApi`.
 *
 *   2. `mountMockEventApi(app)` — attaches `GET /api/events` to an Express
 *      application for end-to-end runs.
 *
 * Behavior is controlled via env vars (so the same mock serves multiple
 * test scenarios without code changes):
 *
 *   MOCK_TOTAL_EVENTS         (default 1000) — total valid records to emit
 *   MOCK_PAGE_SIZE            (default 100)
 *   MOCK_INVALID_RECORDS      (default 50)   — records missing required fields
 *   MOCK_INVALID_DATE_RECORDS (default 20)   — records with un-parseable dates
 *   MOCK_TIMEOUT_PAGES        comma list, e.g. "2,4" — pages that hang
 *   MOCK_5XX_PAGES            comma list — pages that return 503
 *   MOCK_4XX_PAGES            comma list — pages that return 400
 *   MOCK_TIMEOUT_RECOVERS_AFTER (default 1) — # of timeout hits before serving
 */

import type { EventsApiResponse, RawApiEvent } from '../types/pipeline.js';

export interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}

export interface MockEventApiOptions {
  totalEvents?: number;
  pageSize?: number;
  invalidRecords?: number;
  invalidDateRecords?: number;
  /** Pages that should hang past the client's timeout. */
  timeoutPages?: ReadonlyArray<number>;
  /** Pages that should return 503 first then succeed on retry. */
  fivexxPages?: ReadonlyArray<number>;
  /** Pages that should return 400 (non-retryable). */
  fourxxPages?: ReadonlyArray<number>;
  /** How many times a `timeoutPages` entry hangs before recovering. */
  timeoutRecoversAfter?: number;
  /** How many times a `fivexxPages` entry returns 503 before recovering. */
  fivexxRecoversAfter?: number;
  /** Base future date (ms past now) for generated events. */
  futureOffsetMs?: number;
}

/** Build a configured handler. The returned handler is stateful (tracks recoveries). */
export function createMockEventApiHandler(opts: MockEventApiOptions = {}): {
  handle: (url: string, init?: { signal?: AbortSignal }) => Promise<MockResponse>;
  reset: () => void;
} {
  const totalEvents = opts.totalEvents ?? 1000;
  const pageSize = opts.pageSize ?? 100;
  const invalidRecords = opts.invalidRecords ?? 50;
  const invalidDateRecords = opts.invalidDateRecords ?? 20;
  const timeoutPages = new Set(opts.timeoutPages ?? []);
  const fivexxPages = new Set(opts.fivexxPages ?? []);
  const fourxxPages = new Set(opts.fourxxPages ?? []);
  const timeoutRecoversAfter = opts.timeoutRecoversAfter ?? 1;
  const fivexxRecoversAfter = opts.fivexxRecoversAfter ?? 1;
  const futureOffsetMs = opts.futureOffsetMs ?? 7 * 24 * 60 * 60 * 1000;

  const timeoutHits = new Map<number, number>();
  const fivexxHits = new Map<number, number>();

  const reset = (): void => {
    timeoutHits.clear();
    fivexxHits.clear();
  };

  // Pre-build the canonical event list (deterministic by index).
  const events = generateEvents({ totalEvents, invalidRecords, invalidDateRecords, futureOffsetMs });

  const handle = async (url: string, init?: { signal?: AbortSignal }): Promise<MockResponse> => {
    const parsed = new URL(url, 'http://mock');
    const pageParam = parsed.searchParams.get('page');
    const page = pageParam ? Number.parseInt(pageParam, 10) : 1;

    // 4xx — non-retryable
    if (fourxxPages.has(page)) {
      return jsonResponse(400, 'Bad Request', { error: 'mocked 4xx' });
    }

    // 5xx with recovery
    if (fivexxPages.has(page)) {
      const hits = (fivexxHits.get(page) ?? 0) + 1;
      fivexxHits.set(page, hits);
      if (hits <= fivexxRecoversAfter) {
        return jsonResponse(503, 'Service Unavailable', { error: 'mocked 5xx' });
      }
    }

    // Timeout with recovery — implemented by waiting on signal.aborted
    if (timeoutPages.has(page)) {
      const hits = (timeoutHits.get(page) ?? 0) + 1;
      timeoutHits.set(page, hits);
      if (hits <= timeoutRecoversAfter) {
        await waitForAbort(init?.signal);
        // If we get here, the signal aborted (client hit timeout)
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
    }

    const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
    if (page < 1 || page > totalPages) {
      return jsonResponse(404, 'Not Found', { error: 'page out of range' });
    }

    const startIdx = (page - 1) * pageSize;
    const endIdx = Math.min(events.length, startIdx + pageSize);
    const slice = events.slice(startIdx, endIdx);
    const nextPage = page < totalPages ? String(page + 1) : null;

    const body: EventsApiResponse = { events: slice, nextPage };
    return jsonResponse(200, 'OK', body);
  };

  return { handle, reset };
}

function jsonResponse(status: number, statusText: string, body: unknown): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  };
}

function waitForAbort(signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (!signal) {
      // Without a signal we never resolve — but the handler will time out at the test layer.
      return;
    }
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

interface GenerateOpts {
  totalEvents: number;
  invalidRecords: number;
  invalidDateRecords: number;
  futureOffsetMs: number;
}

const CITIES: readonly string[] = [
  'San Francisco, CA',
  'New York, NY',
  'Austin, TX',
  'Seattle, WA',
  'Boston, MA',
  'Chicago, IL',
  'Los Angeles, CA',
  'Denver, CO',
  'Portland, OR',
  'Miami, FL',
];

function pickCity(i: number): string {
  // Safe-by-construction: CITIES is non-empty and we index modulo its length.
  return CITIES[i % CITIES.length] ?? CITIES[0]!;
}

function generateEvents(opts: GenerateOpts): RawApiEvent[] {
  const out: RawApiEvent[] = [];
  const baseTime = Date.now() + opts.futureOffsetMs;

  // 1. Valid records
  const validCount = opts.totalEvents - opts.invalidRecords - opts.invalidDateRecords;
  for (let i = 0; i < validCount; i += 1) {
    out.push({
      id: `ext-event-${i + 1}`,
      name: `Conference ${i + 1}`,
      date: new Date(baseTime + i * 60_000).toISOString(),
      location: pickCity(i),
    });
  }

  // 2. Invalid records — missing required fields
  for (let i = 0; i < opts.invalidRecords; i += 1) {
    const idx = validCount + i;
    out.push({
      id: `ext-invalid-${i + 1}`,
      // Intentionally empty name to trigger validation error.
      name: '',
      date: new Date(baseTime + idx * 60_000).toISOString(),
      location: pickCity(idx),
    });
  }

  // 3. Invalid date records
  for (let i = 0; i < opts.invalidDateRecords; i += 1) {
    out.push({
      id: `ext-baddate-${i + 1}`,
      name: `Bad Date ${i + 1}`,
      date: 'not-a-real-date',
      location: 'San Francisco, CA',
    });
  }

  return out;
}

// ───────────────────────── Optional Express adapter ─────────────────────────

/**
 * Lazily mount the mock API on an Express app. Importing express is
 * deferred so the rest of the package can run without it installed.
 */
export async function mountMockEventApi(app: unknown): Promise<void> {
  const mock = createMockEventApiHandler({
    totalEvents: Number(process.env.MOCK_TOTAL_EVENTS ?? 1000),
    pageSize: Number(process.env.MOCK_PAGE_SIZE ?? 100),
    invalidRecords: Number(process.env.MOCK_INVALID_RECORDS ?? 50),
    invalidDateRecords: Number(process.env.MOCK_INVALID_DATE_RECORDS ?? 20),
    timeoutPages: parseCsvInts(process.env.MOCK_TIMEOUT_PAGES),
    fivexxPages: parseCsvInts(process.env.MOCK_5XX_PAGES),
    fourxxPages: parseCsvInts(process.env.MOCK_4XX_PAGES),
    timeoutRecoversAfter: Number(process.env.MOCK_TIMEOUT_RECOVERS_AFTER ?? 1),
  });

  // Duck-typed Express app handle.
  const expressApp = app as {
    get: (path: string, handler: (req: { url: string }, res: ExpressResLike) => void | Promise<void>) => unknown;
  };
  expressApp.get('/api/events', async (req, res) => {
    try {
      const response = await mock.handle(`http://mock${req.url}`);
      const body = await response.json();
      res.status(response.status).json(body);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}

interface ExpressResLike {
  status: (code: number) => { json: (body: unknown) => unknown };
}

function parseCsvInts(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}
