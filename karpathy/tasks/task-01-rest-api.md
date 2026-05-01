# Task 1: REST API with Validation

**Agent:** dan-backend-engineer

**Objective:** Generate a complete REST API endpoint with input validation, error handling, and proper HTTP semantics.

---

## Input Specification

**Resource:** User

**Schema:**
```
- id: UUID (auto-generated)
- email: string (required, unique)
- name: string (required, 1-100 chars)
- created_at: timestamp (auto-generated)
```

**Requirement:** Build a POST /users endpoint that accepts email and name, validates both, returns 201 with the created user or 400 with validation errors.

---

## Output Specification

Generate an **Express.js/TypeScript handler** that includes:
- ✅ Zod or Joi validation schema
- ✅ Proper HTTP status codes (201, 400, 409 for duplicate email)
- ✅ Error response format with field-level details
- ✅ No hardcoded values; uses environment variables
- ✅ Follows your Code Standards (input validation at boundaries, parameterized queries, error handling)

**Expected file:** `src/handlers/createUser.ts` or equivalent

---

## Success Criteria

The generated code should:
- ✅ Compile without TypeScript errors
- ✅ Pass 5 unit tests:
  1. Valid input (email + name) → returns 201 with created user
  2. Missing email field → returns 400 with error detail
  3. Invalid email format → returns 400 with error
  4. Duplicate email (already exists) → returns 409 conflict error
  5. Missing name field → returns 400 with error
- ✅ Follow the Code Standards from your prompt (no shortcuts, proper structure)
- ✅ No security flaws (no SQL injection, no credential leaks)

---

## How to Use

1. Copy this prompt text
2. Paste it into Claude Code and specify the agent: `@dan-backend-engineer`
3. Save the generated code to `karpathy/output/task-01/` directory
4. Run: `npm run karpathy:validate 1`
5. The script will test compilation and unit tests, record results

---

## Notes

- Use TypeScript with async/await
- Follow the naming conventions and patterns from your Code Standards
- Include comprehensive error messages for validation failures
- Store passwords hashed (if applicable to your design)
