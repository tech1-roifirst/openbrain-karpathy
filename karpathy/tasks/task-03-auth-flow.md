# Task 3: Authentication Flow (JWT)

**Agent:** joey-fullstack-backend

**Objective:** Implement a complete JWT-based login flow with secure password handling.

---

## Input Specification

**Requirement:** Implement a POST /login endpoint that:
- Accepts email + password in request body
- Returns JWT token on success (200)
- Returns 401 Unauthorized on wrong password or user not found
- Stores passwords hashed with bcrypt cost ≥ 12
- Tokens expire in 1 hour

---

## Output Specification

Generate a login handler (Express/TypeScript) that includes:
- ✅ Password hashing logic (bcrypt cost ≥ 12)
- ✅ JWT generation and signing
- ✅ Error handling for: wrong password, user not found, missing fields
- ✅ Proper HTTP status codes (200, 400, 401)
- ✅ No hardcoded secrets; uses environment variables
- ✅ Security considerations documented in comments

---

## Success Criteria

- ✅ Compiles without errors
- ✅ Passes 6 unit tests:
  1. Valid credentials (correct email + password) → 200 with JWT token
  2. Wrong password → 401 Unauthorized
  3. User not found → 401 Unauthorized (don't leak user existence)
  4. Missing email field → 400 Bad Request
  5. Missing password field → 400 Bad Request
  6. JWT token validates correctly when passed to a protected endpoint
- ✅ Passwords stored hashed (never plain text in logs)
- ✅ JWT expires correctly after 1 hour
- ✅ Uses environment variable for JWT secret (not hardcoded)

---

## Notes

- Use async/await for all DB and crypto operations
- Follow OWASP guidelines for authentication
- Document security decisions in code comments
- Assume users table has: id (UUID), email (string, unique), password_hash (string)
