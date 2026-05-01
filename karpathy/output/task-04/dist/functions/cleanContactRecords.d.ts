/**
 * cleanContactRecords
 * -------------------
 * Pure, idempotent transformation that takes an array of raw contact
 * records, normalizes phone numbers, validates and lowercases emails,
 * detects duplicates by email (case-insensitive), and returns a stable,
 * structured array describing each record's validity.
 *
 * Design notes:
 *  - O(n) overall: a single forward pass tallies email occurrences,
 *    a second pass produces output. No nested loops, all lookups via Map.
 *  - Never throws. Internal try/catch around per-record work converts
 *    unexpected errors into validation_errors so the batch always
 *    completes — important for ETL pipelines where one bad row should
 *    not poison a 1000-row batch.
 *  - Idempotent: feeding the output back in yields the same shape
 *    (phone is already digit-only, email already lowercase trimmed),
 *    duplicate detection is deterministic on email value.
 *  - Extra fields on the input are preserved on the output. Canonical
 *    fields always win if both are present.
 */
import { CleanContactRecordsOptions, CleanedContactRecord } from "../types/contact";
/**
 * Clean an array of raw contact records.
 * Always returns an array of the same length (or an empty array for
 * non-array input), never throws.
 */
export declare function cleanContactRecords(records: unknown, options?: CleanContactRecordsOptions): CleanedContactRecord[];
export default cleanContactRecords;
