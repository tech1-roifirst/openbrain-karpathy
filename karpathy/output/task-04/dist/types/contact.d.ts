/**
 * Type definitions for the contact record cleaning pipeline.
 *
 * RawContactRecord represents data as it arrives from upstream sources
 * (e.g., CSV imports, third-party API payloads). All known fields are
 * optional / nullable because real-world ETL inputs are inconsistent.
 *
 * CleanedContactRecord is the post-validation shape produced by
 * `cleanContactRecords`. It always contains the canonical fields,
 * a validity flag, a duplicate flag, and (when invalid) a list of
 * human-readable error messages for downstream debugging.
 */
/** Raw, untrusted contact record from an upstream source. */
export interface RawContactRecord {
    /** Phone number in any format (or null/undefined if absent). */
    phone?: string | null;
    /** Email address in any format (or null/undefined if absent). */
    email?: string | null;
    /** Free-form signup date string. May be missing or malformed. */
    signup_date?: string | null;
    /** Any extra fields are preserved through the pipeline. */
    [key: string]: unknown;
}
/** Cleaned, validated contact record produced by the pipeline. */
export interface CleanedContactRecord {
    /** Normalized phone number (digits only) or empty string if unrecoverable. */
    phone: string;
    /** Validated, lowercased email or empty string if unrecoverable. */
    email: string;
    /** Original signup_date (or null if missing / non-string). */
    signup_date: string | null;
    /** True if both phone and email passed validation. */
    is_valid: boolean;
    /** True if this email appears more than once in the input set. */
    is_duplicate: boolean;
    /** Human-readable validation errors (omitted when is_valid === true). */
    validation_errors?: string[];
    /** Any extra non-canonical fields are passed through unchanged. */
    [key: string]: unknown;
}
/** Optional behavioral knobs for `cleanContactRecords`. */
export interface CleanContactRecordsOptions {
    /**
     * Override logging. Defaults to console.warn when NODE_ENV !== 'test'.
     * Pass a no-op function to silence logs entirely.
     */
    logger?: (message: string, context?: Record<string, unknown>) => void;
}
