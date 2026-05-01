# Task 4: Data Processing Function

**Agent:** dan-backend-engineer

**Objective:** Build a robust data transformation function that handles edge cases and validates output.

---

## Input Specification

**Raw input data** (array of objects):
```json
[
  { "phone": "(555) 123-4567", "email": "john@example.com", "signup_date": "2026-01-15" },
  { "phone": "invalid", "email": "jane@example.com", "signup_date": "2026-01-16" },
  { "phone": "555-123-4567", "email": "john@example.com", "signup_date": "2026-01-15" }
]
```

**Requirement:** Create a function that:
- Cleans phone numbers (remove formatting → digits only, e.g., "5551234567")
- Validates emails (must be valid format, lowercase)
- Deduplicates by email (mark duplicates with is_duplicate flag)
- Returns structured records with validation status

---

## Output Specification

Generate a TypeScript/JavaScript function that:
- ✅ Accepts array of raw records
- ✅ Returns array of cleaned records with fields:
  - phone: normalized (digits only)
  - email: validated and lowercased
  - is_duplicate: boolean
  - is_valid: boolean (did all validations pass?)
- ✅ Handles edge cases: null values, empty strings, malformed data
- ✅ Completes in < 5 seconds on 1000 rows

---

## Success Criteria

- ✅ Compiles without errors
- ✅ Passes 4 integration tests:
  1. Valid record (valid email, valid phone) → cleaned correctly
  2. Invalid email → marked as is_valid=false
  3. Malformed phone → marked as is_valid=false
  4. Duplicate email → marked as is_duplicate=true
- ✅ Performance: 1000 rows processed in < 5 seconds
- ✅ No crashes on edge cases (null, empty string, extreme values)
- ✅ Handles all error cases gracefully without throwing

---

## Notes

- Phone validation: should accept (XXX) XXX-XXXX, XXX-XXX-XXXX, XXXXXXXXXX formats
- Email validation: use a standard regex or email library
- Log any records that fail validation (for debugging)
- Should be idempotent (safe to run multiple times)
