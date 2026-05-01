/**
 * Authentication Types
 *
 * Single source of truth for the request/response contracts and the
 * internal token payload shape used across the login flow, JWT utility,
 * and auth middleware.
 *
 * Author: joey-fullstack-backend
 * Task:   karpathy task-03 (Authentication Flow / JWT)
 */

// ---------------------------------------------------------------------------
// Request / Response contracts (HTTP boundary)
// ---------------------------------------------------------------------------

/** POST /login request body. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Public-facing user fields (never includes password_hash). */
export interface PublicUser {
  id: string;
  email: string;
}

/** POST /login success body (200). */
export interface LoginResponseData {
  /** Signed JWT (HS256) — present `Authorization: Bearer <token>` on subsequent requests. */
  token: string;
  /** Token lifetime in seconds. Mirrors `exp - iat`. */
  expiresIn: number;
  /** Public profile of the authenticated user. */
  user: PublicUser;
}

/** Standard success envelope used across the API. */
export interface SuccessEnvelope<T> {
  data: T;
}

/** Standard error envelope used across the API. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

/** Convenience type alias for the full /login success body. */
export type LoginResponse = SuccessEnvelope<LoginResponseData>;

// ---------------------------------------------------------------------------
// JWT payload
// ---------------------------------------------------------------------------

/**
 * Token payload shape — claims encoded into every issued JWT.
 *
 * - `sub`   : user id (subject) — RFC 7519 standard claim
 * - `email` : convenience claim, avoids a DB hit on every request to display
 *             the current user's email. Trust boundary: the email here
 *             reflects state at issue-time; downstream code that depends on
 *             current state MUST re-read from the DB.
 * - `iat`   : issued-at (seconds since epoch)
 * - `exp`   : expires-at (seconds since epoch)
 *
 * NOTE: We intentionally do NOT embed roles, permissions, or PII here.
 * Authorization decisions should consult the DB or a dedicated claim service.
 */
export interface TokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

/** The minimum input needed to mint a token. */
export interface TokenIssueInput {
  userId: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Authenticated request user (populated by auth middleware)
// ---------------------------------------------------------------------------

/**
 * Shape attached to `req.user` by the auth middleware after a token is
 * successfully verified. Downstream handlers should rely on this type
 * rather than re-decoding the token.
 */
export interface AuthUser {
  id: string;
  email: string;
  /** Token issued-at timestamp (seconds since epoch). */
  tokenIssuedAt: number;
  /** Token expiry timestamp (seconds since epoch). */
  tokenExpiresAt: number;
}

// ---------------------------------------------------------------------------
// Repository contract for the login flow
// ---------------------------------------------------------------------------

/** Row shape stored by the user repository — `password_hash` never leaves the server. */
export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
}

/** Minimal repository surface required by the /login handler. */
export interface UserRepository {
  /**
   * Look up a user by email. MUST use parameterized queries.
   * Implementations SHOULD lower-case + trim the email at the DB layer
   * (or rely on a citext / functional index) to make lookups consistent.
   * Returns `null` when no user exists.
   */
  findByEmail(email: string): Promise<UserRecord | null>;
}

// ---------------------------------------------------------------------------
// Express type augmentation — adds `req.user` for routes behind auth middleware
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by `requireAuth` middleware once a JWT is verified. */
      user?: AuthUser;
    }
  }
}

export {};
