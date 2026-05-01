"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanContactRecords = cleanContactRecords;
/**
 * RFC-5322-lite regex. Strict enough to reject the common bad inputs
 * (missing local part, missing domain, missing TLD, internal whitespace)
 * while accepting "+tag" and dotted local parts. We deliberately do not
 * try to fully implement RFC 5322 — that path leads to madness and is
 * almost never what a data pipeline actually wants.
 */
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
/** Reserved keys we manage ourselves; everything else passes through. */
const RESERVED_KEYS = new Set([
    "phone",
    "email",
    "signup_date",
    "is_valid",
    "is_duplicate",
    "validation_errors",
]);
/**
 * Normalize a phone string into digits only.
 * Accepts:
 *   (XXX) XXX-XXXX
 *   XXX-XXX-XXXX
 *   XXXXXXXXXX
 *   +1-XXX-XXX-XXXX  (country code allowed)
 *   surrounding whitespace
 * Returns { value, error }. value is the digits-only string, or "" if
 * it could not be coerced. error is null on success.
 */
function normalizePhone(input) {
    if (input === null || input === undefined) {
        return { value: "", error: "phone is missing" };
    }
    if (typeof input !== "string") {
        return { value: "", error: "phone must be a string" };
    }
    const trimmed = input.trim();
    if (trimmed === "") {
        return { value: "", error: "phone is empty" };
    }
    // Strip everything that isn't a digit. We intentionally drop the leading
    // "+" because the digits-only output is what callers downstream want.
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10) {
        // Plain US number.
        return { value: digits, error: null };
    }
    if (digits.length === 11 && digits.startsWith("1")) {
        // US with country code; canonicalize to the 10-digit form so that
        // "+1-555-123-4567" and "555-123-4567" dedupe to the same value.
        return { value: digits.slice(1), error: null };
    }
    if (digits.length >= 11 && digits.length <= 15) {
        // Generic international (E.164 max is 15 digits).
        return { value: digits, error: null };
    }
    return {
        value: "",
        error: `phone has invalid length (${digits.length} digits) after normalization`,
    };
}
/**
 * Normalize and validate an email.
 * Trims, lowercases, runs through EMAIL_REGEX. Returns { value, error }.
 */
function normalizeEmail(input) {
    if (input === null || input === undefined) {
        return { value: "", error: "email is missing" };
    }
    if (typeof input !== "string") {
        return { value: "", error: "email must be a string" };
    }
    const cleaned = input.trim().toLowerCase();
    if (cleaned === "") {
        return { value: "", error: "email is empty" };
    }
    if (cleaned.length > 254) {
        // RFC 5321 hard cap. Anything longer is almost certainly junk.
        return { value: cleaned, error: "email exceeds 254 characters" };
    }
    if (!EMAIL_REGEX.test(cleaned)) {
        return { value: cleaned, error: "email format is invalid" };
    }
    return { value: cleaned, error: null };
}
/** Default logger picks a sane channel based on NODE_ENV. */
function defaultLogger(message, context) {
    if (process.env.NODE_ENV === "test") {
        return; // silence by default during tests
    }
    if (context && Object.keys(context).length > 0) {
        // eslint-disable-next-line no-console
        console.warn(`[cleanContactRecords] ${message}`, context);
    }
    else {
        // eslint-disable-next-line no-console
        console.warn(`[cleanContactRecords] ${message}`);
    }
}
/**
 * Clean an array of raw contact records.
 * Always returns an array of the same length (or an empty array for
 * non-array input), never throws.
 */
function cleanContactRecords(records, options = {}) {
    const log = options.logger ?? defaultLogger;
    // Defensive: accept any input, return empty for non-arrays.
    if (!Array.isArray(records)) {
        log("input was not an array; returning []", { receivedType: typeof records });
        return [];
    }
    // ---- Pass 1: count email occurrences for duplicate detection. ----
    // We count using the *normalized* email (trim + lowercase) so that
    // "JOHN@X.COM" and "john@x.com" collapse to the same key.
    const emailCounts = new Map();
    for (let i = 0; i < records.length; i++) {
        const raw = records[i];
        if (raw === null || raw === undefined || typeof raw !== "object") {
            continue;
        }
        const { value: emailValue, error: emailError } = normalizeEmail(raw.email);
        if (emailError === null && emailValue !== "") {
            emailCounts.set(emailValue, (emailCounts.get(emailValue) ?? 0) + 1);
        }
    }
    // ---- Pass 2: produce the cleaned records. ----
    const out = new Array(records.length);
    for (let i = 0; i < records.length; i++) {
        out[i] = buildCleanedRecord(records[i], i, emailCounts, log);
    }
    return out;
}
/** Build one cleaned record. Internally try/catch'd so a row never throws. */
function buildCleanedRecord(raw, index, emailCounts, log) {
    try {
        // Reject anything that isn't a plain record.
        const record = raw !== null && raw !== undefined && typeof raw === "object"
            ? raw
            : {};
        const { value: phone, error: phoneError } = normalizePhone(record.phone);
        const { value: email, error: emailError } = normalizeEmail(record.email);
        const validationErrors = [];
        if (phoneError)
            validationErrors.push(phoneError);
        if (emailError)
            validationErrors.push(emailError);
        const isValid = validationErrors.length === 0;
        const isDuplicate = emailError === null && email !== "" && (emailCounts.get(email) ?? 0) > 1;
        // Carry signup_date verbatim if it's a string; null otherwise.
        const signupDate = typeof record.signup_date === "string" ? record.signup_date : null;
        // Preserve unknown extra fields (anything not in RESERVED_KEYS).
        const cleaned = {
            phone,
            email,
            signup_date: signupDate,
            is_valid: isValid,
            is_duplicate: isDuplicate,
        };
        if (raw !== null && raw !== undefined && typeof raw === "object") {
            for (const key of Object.keys(raw)) {
                if (!RESERVED_KEYS.has(key)) {
                    cleaned[key] = raw[key];
                }
            }
        }
        if (!isValid) {
            cleaned.validation_errors = validationErrors;
            log("invalid record", { index, errors: validationErrors });
        }
        return cleaned;
    }
    catch (err) {
        // Last-resort safety net. Should be unreachable, but ETL says
        // "should be unreachable" is exactly when production breaks.
        const message = err instanceof Error ? err.message : String(err);
        log("unexpected error processing record", { index, error: message });
        return {
            phone: "",
            email: "",
            signup_date: null,
            is_valid: false,
            is_duplicate: false,
            validation_errors: [`internal error: ${message}`],
        };
    }
}
exports.default = cleanContactRecords;
//# sourceMappingURL=cleanContactRecords.js.map