"use strict";
/**
 * Test suite for cleanContactRecords.
 *
 * Covers:
 *  - 4 integration tests for happy path and primary error cases
 *  - 8 edge case tests (null phone, empty email, whitespace, casing,
 *    plus-tagged email, case-insensitive dedupe, extra-field passthrough,
 *    1000-row throughput)
 *  - 4 robustness tests (non-array input, weird types, idempotency,
 *    silent logger respected)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const cleanContactRecords_1 = require("./cleanContactRecords");
// Provide a no-op logger to most tests so we don't depend on NODE_ENV.
const silent = () => undefined;
describe("cleanContactRecords — integration", () => {
    test("integration #1: valid record is cleaned correctly with is_valid=true", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([
            {
                phone: "(555) 123-4567",
                email: "John@Example.com",
                signup_date: "2026-01-15",
            },
        ], { logger: silent });
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({
            phone: "5551234567",
            email: "john@example.com",
            signup_date: "2026-01-15",
            is_valid: true,
            is_duplicate: false,
        });
        expect(out[0].validation_errors).toBeUndefined();
    });
    test("integration #2: invalid email is flagged with validation_errors", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([{ phone: "555-123-4567", email: "not-an-email", signup_date: "2026-01-16" }], { logger: silent });
        expect(out[0].is_valid).toBe(false);
        expect(out[0].validation_errors).toBeDefined();
        expect(out[0].validation_errors.some((e) => e.includes("email"))).toBe(true);
    });
    test("integration #3: malformed phone is flagged with validation_errors", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([{ phone: "invalid", email: "jane@example.com", signup_date: "2026-01-16" }], { logger: silent });
        expect(out[0].is_valid).toBe(false);
        expect(out[0].email).toBe("jane@example.com");
        expect(out[0].validation_errors).toBeDefined();
        expect(out[0].validation_errors.some((e) => e.includes("phone"))).toBe(true);
    });
    test("integration #4: duplicate email — both occurrences marked is_duplicate=true", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([
            { phone: "(555) 123-4567", email: "john@example.com", signup_date: "2026-01-15" },
            { phone: "555-987-6543", email: "john@example.com", signup_date: "2026-01-20" },
        ], { logger: silent });
        expect(out[0].is_duplicate).toBe(true);
        expect(out[1].is_duplicate).toBe(true);
        // Order is preserved.
        expect(out[0].signup_date).toBe("2026-01-15");
        expect(out[1].signup_date).toBe("2026-01-20");
    });
});
describe("cleanContactRecords — edge cases", () => {
    test("edge #1: null phone is handled gracefully and marked invalid", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([{ phone: null, email: "ok@example.com" }], { logger: silent });
        expect(out[0].is_valid).toBe(false);
        expect(out[0].phone).toBe("");
        expect(out[0].validation_errors.some((e) => e.includes("phone"))).toBe(true);
    });
    test("edge #2: empty-string email is handled gracefully and marked invalid", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([{ phone: "5551234567", email: "" }], { logger: silent });
        expect(out[0].is_valid).toBe(false);
        expect(out[0].email).toBe("");
        expect(out[0].validation_errors.some((e) => e.includes("email"))).toBe(true);
    });
    test("edge #3: whitespace phone is trimmed and normalized", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([{ phone: "(555) 123-4567 ", email: "ok@example.com" }], { logger: silent });
        expect(out[0].phone).toBe("5551234567");
        expect(out[0].is_valid).toBe(true);
    });
    test("edge #4: uppercase email is lowercased", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([{ phone: "5551234567", email: "JOHN@EXAMPLE.COM" }], { logger: silent });
        expect(out[0].email).toBe("john@example.com");
        expect(out[0].is_valid).toBe(true);
    });
    test("edge #5: email with plus tag is accepted", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([{ phone: "5551234567", email: "john+tag@example.com" }], { logger: silent });
        expect(out[0].email).toBe("john+tag@example.com");
        expect(out[0].is_valid).toBe(true);
    });
    test("edge #6: case-insensitive duplicate detection", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([
            { phone: "5551234567", email: "JOHN@X.COM" },
            { phone: "5559876543", email: "john@x.com" },
        ], { logger: silent });
        expect(out[0].is_duplicate).toBe(true);
        expect(out[1].is_duplicate).toBe(true);
        expect(out[0].email).toBe("john@x.com");
        expect(out[1].email).toBe("john@x.com");
    });
    test("edge #7: extra fields are preserved on the output", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([
            {
                phone: "5551234567",
                email: "ok@example.com",
                source: "csv-import",
                tags: ["vip", "newsletter"],
            },
        ], { logger: silent });
        expect(out[0].source).toBe("csv-import");
        expect(out[0].tags).toEqual(["vip", "newsletter"]);
    });
    test("edge #8: 1000 rows complete in well under 5 seconds", () => {
        const rows = [];
        for (let i = 0; i < 1000; i++) {
            rows.push({
                phone: `(555) 123-${String(1000 + (i % 9000)).padStart(4, "0")}`,
                // Half duplicates, half unique, to exercise the dedupe path.
                email: i % 2 === 0 ? `user${i}@example.com` : `shared@example.com`,
                signup_date: "2026-01-15",
            });
        }
        const start = Date.now();
        const out = (0, cleanContactRecords_1.cleanContactRecords)(rows, { logger: silent });
        const elapsed = Date.now() - start;
        expect(out).toHaveLength(1000);
        expect(elapsed).toBeLessThan(5000);
        // All "shared@example.com" rows should be marked duplicates.
        const sharedDupes = out.filter((r) => r.email === "shared@example.com");
        expect(sharedDupes.length).toBeGreaterThan(0);
        expect(sharedDupes.every((r) => r.is_duplicate)).toBe(true);
    });
});
describe("cleanContactRecords — robustness", () => {
    test("non-array input returns empty array (does not throw)", () => {
        expect((0, cleanContactRecords_1.cleanContactRecords)(null, { logger: silent })).toEqual([]);
        expect((0, cleanContactRecords_1.cleanContactRecords)(undefined, { logger: silent })).toEqual([]);
        expect((0, cleanContactRecords_1.cleanContactRecords)("nope", { logger: silent })).toEqual([]);
        expect((0, cleanContactRecords_1.cleanContactRecords)({}, { logger: silent })).toEqual([]);
    });
    test("non-object record entries are normalized to invalid records", () => {
        const out = (0, cleanContactRecords_1.cleanContactRecords)([null, undefined, 42, "x", { phone: "5551234567", email: "ok@x.com" }], { logger: silent });
        expect(out).toHaveLength(5);
        expect(out[0].is_valid).toBe(false);
        expect(out[1].is_valid).toBe(false);
        expect(out[2].is_valid).toBe(false);
        expect(out[3].is_valid).toBe(false);
        expect(out[4].is_valid).toBe(true);
    });
    test("idempotent: feeding output back in produces the same canonical fields", () => {
        const first = (0, cleanContactRecords_1.cleanContactRecords)([{ phone: "(555) 123-4567", email: "John@Example.com", signup_date: "2026-01-15" }], { logger: silent });
        const second = (0, cleanContactRecords_1.cleanContactRecords)(first, {
            logger: silent,
        });
        expect(second[0].phone).toBe(first[0].phone);
        expect(second[0].email).toBe(first[0].email);
        expect(second[0].signup_date).toBe(first[0].signup_date);
        expect(second[0].is_valid).toBe(first[0].is_valid);
    });
    test("custom logger receives invalid-record diagnostics", () => {
        const calls = [];
        (0, cleanContactRecords_1.cleanContactRecords)([{ phone: "x", email: "y" }], {
            logger: (msg, ctx) => {
                calls.push({ msg, ctx });
            },
        });
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0].msg).toContain("invalid record");
        expect(calls[0].ctx).toHaveProperty("index", 0);
        expect(Array.isArray(calls[0].ctx.errors)).toBe(true);
    });
});
//# sourceMappingURL=cleanContactRecords.test.js.map