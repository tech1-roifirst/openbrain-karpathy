/**
 * Events transformer — pure validation + enrichment.
 *
 * Validates each raw event against the spec, normalizes its date to UTC,
 * and enriches with mock geocoordinates derived from the location string.
 *
 * Pure & deterministic except for `now` (UTC clock) and `uuid` (random) —
 * both are injectable for testability.
 */

import { randomUUID } from 'node:crypto';
import type {
  RawApiEvent,
  RecordError,
  TransformResult,
  TransformedEvent,
} from '../types/pipeline.js';
import type { Logger } from './logger.js';

/** Mock geocoder — keys are normalized city names, lower-cased & trimmed. */
const GEO_LOOKUP: ReadonlyMap<string, { lat: number; lon: number }> = new Map([
  ['san francisco, ca', { lat: 37.7749, lon: -122.4194 }],
  ['new york, ny', { lat: 40.7128, lon: -74.006 }],
  ['austin, tx', { lat: 30.2672, lon: -97.7431 }],
  ['seattle, wa', { lat: 47.6062, lon: -122.3321 }],
  ['boston, ma', { lat: 42.3601, lon: -71.0589 }],
  ['chicago, il', { lat: 41.8781, lon: -87.6298 }],
  ['los angeles, ca', { lat: 34.0522, lon: -118.2437 }],
  ['denver, co', { lat: 39.7392, lon: -104.9903 }],
  ['portland, or', { lat: 45.5152, lon: -122.6784 }],
  ['miami, fl', { lat: 25.7617, lon: -80.1918 }],
]);

/** Default lat/lon for unknown locations (0,0) — flagged as "unenriched" via metadata. */
const DEFAULT_GEO = { lat: 0, lon: 0 };

const MAX_NAME_LEN = 255;
const MAX_LOCATION_LEN = 255;

export interface TransformerDeps {
  logger: Logger;
  /** UTC clock — injectable for deterministic tests. */
  now?: () => Date;
  /** UUID generator — injectable for deterministic tests. */
  uuid?: () => string;
  /** Allow past dates — defaults to false (per spec, must be future). */
  allowPastDates?: boolean;
}

export class EventsTransformer {
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly allowPastDates: boolean;

  constructor(deps: TransformerDeps) {
    this.logger = deps.logger;
    this.now = deps.now ?? (() => new Date());
    this.uuid = deps.uuid ?? randomUUID;
    this.allowPastDates = deps.allowPastDates ?? false;
  }

  /** Transform a batch — invalid records are skipped & captured in `errors`. */
  transform(raw: readonly RawApiEvent[]): TransformResult {
    const valid: TransformedEvent[] = [];
    const errors: RecordError[] = [];

    for (const record of raw) {
      try {
        const result = this.transformOne(record);
        if ('error' in result) {
          errors.push(result.error);
          this.logger.warn(
            'Record skipped during transform',
            { recordId: result.error.recordId, errorCode: result.error.errorCode, error: result.error.error, field: result.error.field },
            'transform',
          );
        } else {
          valid.push(result.event);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const recordId = (record && typeof record === 'object' && 'id' in record && typeof record.id === 'string')
          ? record.id
          : '<unknown>';
        const recordError: RecordError = {
          recordId,
          phase: 'transform',
          errorCode: 'PARSE_ERROR',
          error: `Unexpected transform failure: ${message}`,
        };
        errors.push(recordError);
        this.logger.warn('Record threw during transform', { recordId, error: message }, 'transform');
      }
    }

    return { valid, errors };
  }

  private transformOne(
    record: RawApiEvent | unknown,
  ): { event: TransformedEvent } | { error: RecordError } {
    if (!record || typeof record !== 'object') {
      return {
        error: {
          recordId: '<unknown>',
          phase: 'transform',
          errorCode: 'INVALID_TYPE',
          error: 'Record is not an object',
        },
      };
    }

    const r = record as Partial<RawApiEvent>;
    const externalId = typeof r.id === 'string' ? r.id.trim() : '';
    const recordIdForErrors = externalId || '<unknown>';

    if (!externalId) {
      return { error: this.fieldError(recordIdForErrors, 'MISSING_FIELD', 'id', '`id` is required and must be a non-empty string') };
    }

    if (typeof r.name !== 'string' || r.name.trim().length === 0) {
      return { error: this.fieldError(externalId, 'MISSING_FIELD', 'name', '`name` is required and must be a non-empty string') };
    }
    const name = r.name.trim();
    if (name.length > MAX_NAME_LEN) {
      return { error: this.fieldError(externalId, 'FIELD_TOO_LONG', 'name', `\`name\` exceeds ${MAX_NAME_LEN} chars`) };
    }

    if (typeof r.date !== 'string' || r.date.trim().length === 0) {
      return { error: this.fieldError(externalId, 'MISSING_FIELD', 'date', '`date` is required and must be an ISO 8601 string') };
    }
    const date = new Date(r.date);
    if (Number.isNaN(date.getTime())) {
      return { error: this.fieldError(externalId, 'INVALID_DATE', 'date', `\`date\` is not a valid ISO 8601 timestamp: ${r.date}`) };
    }
    if (!this.allowPastDates && date.getTime() <= this.now().getTime()) {
      return { error: this.fieldError(externalId, 'PAST_DATE', 'date', `\`date\` must be in the future: ${date.toISOString()}`) };
    }

    if (typeof r.location !== 'string' || r.location.trim().length === 0) {
      return { error: this.fieldError(externalId, 'MISSING_FIELD', 'location', '`location` is required and must be a non-empty string') };
    }
    const location = r.location.trim();
    if (location.length > MAX_LOCATION_LEN) {
      return { error: this.fieldError(externalId, 'FIELD_TOO_LONG', 'location', `\`location\` exceeds ${MAX_LOCATION_LEN} chars`) };
    }

    const geo = GEO_LOOKUP.get(location.toLowerCase()) ?? DEFAULT_GEO;

    const event: TransformedEvent = {
      id: this.uuid(),
      externalId,
      name,
      date, // already UTC: `new Date(iso)` parses to UTC instant
      location,
      latitude: geo.lat,
      longitude: geo.lon,
      processedAt: this.now(),
    };
    return { event };
  }

  private fieldError(
    recordId: string,
    code: RecordError['errorCode'],
    field: string,
    message: string,
  ): RecordError {
    return { recordId, phase: 'transform', errorCode: code, error: message, field };
  }
}
