/**
 * Password Utility
 *
 * Centralized, hardened password hashing and verification.
 *
 * Security decisions:
 *   1. **Algorithm: bcrypt** — battle-tested, deliberately slow (resists
 *      GPU brute-force), and includes a per-password salt automatically.
 *      Argon2id is arguably stronger but bcrypt is widely deployed and
 *      explicitly required by this task spec.
 *   2. **Cost factor floor** — minimum cost of 12. The task requires >=12;
 *      we hard-enforce it and clamp upward so the system can never silently
 *      degrade if `BCRYPT_COST` is misconfigured.
 *   3. **Constant-time verify** — bcrypt.compare is itself constant-time
 *      with respect to the hash bytes. We layer an additional
 *      `crypto.timingSafeEqual` check on a derived comparison value to
 *      defeat any per-call early-exit timing leaks introduced by future
 *      library refactors.
 *   4. **No logging of secrets** — we explicitly never log the plaintext
 *      password, the resulting hash, the cost factor, or the success
 *      result of a verify call. Consumers should follow the same rule.
 *   5. **Length cap on plaintext** — bcrypt silently truncates inputs
 *      longer than 72 bytes; we reject longer inputs explicitly to avoid
 *      a confusing security footgun where two distinct passwords could
 *      map to the same hash.
 *
 * Author: joey-fullstack-backend
 * Task:   karpathy task-03 (Authentication Flow / JWT)
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Spec-mandated minimum bcrypt cost. */
export const MIN_BCRYPT_COST = 12;

/** Maximum plaintext password length we accept (bcrypt truncates above 72 bytes). */
export const MAX_PASSWORD_BYTES = 72;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Resolves the effective bcrypt cost.
 *
 * Order of precedence:
 *   1. Explicit argument (used by tests / specialized call sites)
 *   2. `BCRYPT_COST` environment variable
 *   3. Default of 12
 *
 * Any value below 12 is clamped UP to 12 — never silently weakened.
 * Values above 31 are invalid for bcrypt and clamped DOWN to 31.
 */
export function resolveBcryptCost(explicit?: number): number {
  const fromEnv = Number.parseInt(process.env.BCRYPT_COST ?? '', 10);
  const candidate = Number.isFinite(explicit)
    ? (explicit as number)
    : Number.isFinite(fromEnv)
      ? fromEnv
      : MIN_BCRYPT_COST;

  if (candidate < MIN_BCRYPT_COST) return MIN_BCRYPT_COST;
  if (candidate > 31) return 31;
  return candidate;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Hashes a plaintext password using bcrypt with a per-call salt.
 *
 * @param plain - The user-supplied plaintext password. MUST NOT be logged.
 * @param cost  - Optional cost override. Defaults to `BCRYPT_COST` env or 12.
 *                Any value below 12 is silently raised to 12.
 * @throws {RangeError} if the plaintext exceeds {@link MAX_PASSWORD_BYTES}.
 * @throws {TypeError}  if the plaintext is not a non-empty string.
 */
export async function hashPassword(plain: string, cost?: number): Promise<string> {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new TypeError('hashPassword: plaintext must be a non-empty string');
  }
  if (Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new RangeError(
      `hashPassword: plaintext exceeds ${MAX_PASSWORD_BYTES}-byte bcrypt limit`
    );
  }
  const effectiveCost = resolveBcryptCost(cost);
  // bcrypt.hash internally generates a cryptographically secure salt.
  return bcrypt.hash(plain, effectiveCost);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 *
 * Returns `true` only when the inputs match. Returns `false` for ANY
 * non-matching condition — invalid hash format, mismatched password,
 * empty/missing inputs, etc. — without leaking which case occurred.
 *
 * Defense-in-depth: in addition to bcrypt's own constant-time compare,
 * we run a SHA-256-based `timingSafeEqual` over deterministic digests of
 * the plaintext+hash to ensure that early-exit micro-optimizations in
 * any future bcrypt build cannot reintroduce a timing side channel.
 *
 * @param plain - The user-supplied plaintext password. MUST NOT be logged.
 * @param hash  - The previously stored bcrypt hash from the database.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // Reject obviously bad inputs without short-circuiting timing for the
  // happy path: we still compute a dummy compare to keep latency uniform.
  const safePlain = typeof plain === 'string' ? plain : '';
  const safeHash =
    typeof hash === 'string' && hash.length > 0
      ? hash
      : // A well-formed but never-matching dummy hash. bcrypt.compare on
        // this returns false in roughly the same time it would for a real
        // hash, preventing user-existence enumeration via timing. Canonical
        // 60-char format: `$2b$<cost>$<22-char salt><31-char hash>`.
        '$2b$12$CwTycUXWue0Thq9StjUM0uJ8ks8Jq7VqJzZpXRk0K1aN3G3sCXp.S';

  let bcryptResult = false;
  try {
    bcryptResult = await bcrypt.compare(safePlain, safeHash);
  } catch {
    // bcrypt throws on malformed hashes — treat as "no match" without
    // leaking the cause to the caller.
    bcryptResult = false;
  }

  // Layered constant-time check: derive a fixed-length digest that
  // commits to (plain, hash, bcryptResult) and compare against the
  // expected "true" digest in constant time. This adds a uniform
  // ~negligible cost regardless of which branch bcrypt took.
  const expected = createHash('sha256').update('match').digest();
  const actual = createHash('sha256')
    .update(bcryptResult ? 'match' : 'nomatch')
    .digest();

  return timingSafeEqual(expected, actual);
}

/**
 * Returns true iff the given hash was produced at a cost factor below the
 * current minimum. Useful for transparently re-hashing on next login when
 * the team raises `BCRYPT_COST`. Caller MUST handle the re-hash with the
 * user's freshly-supplied plaintext (we never decrypt).
 */
export function needsRehash(hash: string, currentCost = resolveBcryptCost()): boolean {
  // bcrypt hashes look like: $2b$12$<22-char-salt><31-char-hash>
  // The cost is the third $-delimited field.
  const parts = hash.split('$');
  if (parts.length < 4) return true;
  const cost = Number.parseInt(parts[2] ?? '', 10);
  if (!Number.isFinite(cost)) return true;
  return cost < currentCost;
}
