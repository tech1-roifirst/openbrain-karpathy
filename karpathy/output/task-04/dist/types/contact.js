"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=contact.js.map