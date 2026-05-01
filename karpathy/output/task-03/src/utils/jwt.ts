/**
 * JWT Utility
 *
 * Centralized signing + verification using `jsonwebtoken`. All tokens
 * issued by this service flow through this module — there are no other
 * `jwt.sign` / `jwt.verify` call sites in the codebase.
 *
 * Security decisions:
 *   1. **Algorithm pinned to HS256** on both sign AND verify. Pinning the
 *      verify-side algorithm defeats the classic "alg=none" and
 *      RSA->HMAC confusion attacks (see CVE-2015-9235).
 *   2. **Secret loaded from env at call time** (not module load) so test
 *      harnesses can swap `JWT_SECRET` per-suite. The secret is never
 *      logged, never returned, and never embedded in error messages.
 *   3. **Strong secret enforcement** in production — refuses to start
 *      signing with a secret shorter than 32 chars when
 *      `NODE_ENV=production`. In dev/test we allow short secrets to keep
 *      ergonomics reasonable.
 *   4. **Issuer + audience claims** tied to a stable service identifier so
 *      a token issued by another service in the same JWKS cannot be
 *      replayed against this one.
 *   5. **`verifyToken` returns a discriminated result** instead of
 *      throwing string-based errors, so middleware can map "expired"
 *      vs "invalid" to distinct (but never user-enumerating) responses.
 *
 * Author: joey-fullstack-backend
 * Task:   karpathy task-03 (Authentication Flow / JWT)
 */

import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import type { TokenIssueInput, TokenPayload } from '../types/auth';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default token lifetime: 1 hour, per task spec. */
export const DEFAULT_TOKEN_EXPIRY_SECONDS = 3600;

/** Minimum acceptable JWT secret length in production (chars). */
const MIN_SECRET_LENGTH_PROD = 32;

const ISSUER = process.env.JWT_ISSUER || 'karpathy-task-03';
const AUDIENCE = process.env.JWT_AUDIENCE || 'karpathy-task-03-clients';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Loads and validates `JWT_SECRET` at call time. Throws a configuration
 * error rather than a security error if missing — the application MUST
 * fail closed at startup if the operator forgot to set it.
 */
function loadSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length === 0) {
    throw new Error(
      'JWT misconfiguration: JWT_SECRET environment variable is required'
    );
  }
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProduction && secret.length < MIN_SECRET_LENGTH_PROD) {
    throw new Error(
      `JWT misconfiguration: JWT_SECRET must be at least ${MIN_SECRET_LENGTH_PROD} characters in production`
    );
  }
  return secret;
}

function resolveExpirySeconds(explicit?: number): number {
  if (Number.isFinite(explicit) && (explicit as number) > 0) return explicit as number;
  const fromEnv = Number.parseInt(process.env.TOKEN_EXPIRY_SECONDS ?? '', 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return DEFAULT_TOKEN_EXPIRY_SECONDS;
}

// ---------------------------------------------------------------------------
// Public API — sign
// ---------------------------------------------------------------------------

export interface IssuedToken {
  /** The signed compact JWS string. */
  token: string;
  /** Token lifetime in seconds. */
  expiresIn: number;
  /** Issued-at timestamp (seconds since epoch). */
  issuedAt: number;
  /** Expiry timestamp (seconds since epoch). */
  expiresAt: number;
}

/**
 * Mint a new JWT for the given user.
 *
 * @param input  - `userId` becomes the `sub` claim; `email` is embedded as
 *                 a custom claim so middleware can populate `req.user`
 *                 without an extra DB hit.
 * @param expiry - Optional override for the token lifetime in seconds.
 *                 Defaults to `TOKEN_EXPIRY_SECONDS` env or 3600.
 */
export function generateToken(
  userIdOrInput: string | TokenIssueInput,
  emailMaybe?: string,
  expiry?: number
): IssuedToken {
  // Support both the spec-mandated `(userId, email)` signature and an
  // object-input variant for ergonomic call sites.
  const userId =
    typeof userIdOrInput === 'string' ? userIdOrInput : userIdOrInput.userId;
  const email =
    typeof userIdOrInput === 'string' ? (emailMaybe as string) : userIdOrInput.email;

  if (!userId || typeof userId !== 'string') {
    throw new TypeError('generateToken: userId must be a non-empty string');
  }
  if (!email || typeof email !== 'string') {
    throw new TypeError('generateToken: email must be a non-empty string');
  }

  const secret = loadSecret();
  const expiresIn = resolveExpirySeconds(expiry);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + expiresIn;

  // Note: we set `iat`/`exp` explicitly via the payload AND mirror via
  // SignOptions.expiresIn so any future change to clock-skew handling
  // remains correct. `jsonwebtoken` honors the explicit claims.
  const payload: TokenPayload = {
    sub: userId,
    email,
    iat: issuedAt,
    exp: expiresAt,
  };

  const options: SignOptions = {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: AUDIENCE,
  };

  const token = jwt.sign(payload, secret, options);
  return { token, expiresIn, issuedAt, expiresAt };
}

// ---------------------------------------------------------------------------
// Public API — verify
// ---------------------------------------------------------------------------

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'expired' | 'invalid' | 'malformed' | 'misconfigured' };

/**
 * Verify a JWT and return its payload.
 *
 * Returns a discriminated result rather than throwing so that callers
 * (e.g. auth middleware) can map states to HTTP responses without
 * try/catch-driven control flow.
 *
 * Verification enforces:
 *   - HS256 algorithm (defeats alg=none and HS/RS confusion)
 *   - Matching issuer and audience claims
 *   - Non-expired `exp`
 *   - Required `sub` and `email` claims of type string
 */
export function verifyToken(token: string): VerifyResult {
  if (typeof token !== 'string' || token.length === 0) {
    return { ok: false, reason: 'malformed' };
  }

  let secret: string;
  try {
    secret = loadSecret();
  } catch {
    return { ok: false, reason: 'misconfigured' };
  }

  const options: VerifyOptions = {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  };

  try {
    const decoded = jwt.verify(token, secret, options) as JwtPayload;

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof decoded.sub !== 'string' ||
      typeof (decoded as Record<string, unknown>).email !== 'string' ||
      typeof decoded.iat !== 'number' ||
      typeof decoded.exp !== 'number'
    ) {
      return { ok: false, reason: 'invalid' };
    }

    const payload: TokenPayload = {
      sub: decoded.sub,
      email: (decoded as Record<string, unknown>).email as string,
      iat: decoded.iat,
      exp: decoded.exp,
    };
    return { ok: true, payload };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { ok: false, reason: 'expired' };
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: false, reason: 'invalid' };
  }
}
