/**
 * Auth Middleware
 *
 * `requireAuth` is the standard gate placed in front of any route that
 * requires a logged-in user. It:
 *   1. Pulls the token from `Authorization: Bearer <token>` (case-insensitive
 *      scheme, defense against accidental "bearer" / "BEARER" client code).
 *   2. Verifies the token using the shared {@link verifyToken} utility,
 *      which pins HS256, validates iss/aud, and checks exp.
 *   3. Populates `req.user` with the verified claims so downstream handlers
 *      never need to re-parse the token.
 *
 * Security decisions:
 *   - Uniform 401 messages across all failure modes (missing header,
 *     malformed header, invalid signature, expired token). The `code`
 *     field differs to aid client UX (e.g. trigger a refresh on
 *     `TOKEN_EXPIRED`) but the `message` does not leak structural info.
 *   - We refuse to parse a token longer than 4096 chars — a JWT longer
 *     than that is almost certainly an attack payload, and parsing it
 *     wastes CPU on the auth path.
 *   - We never log the token. Only the verification outcome is logged
 *     (via the `logger` parameter, when provided), and even then we log
 *     a short prefix only for correlation, never the full token.
 *
 * Author: joey-fullstack-backend
 * Task:   karpathy task-03 (Authentication Flow / JWT)
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import type { AuthUser, ErrorEnvelope } from '../types/auth';

// ---------------------------------------------------------------------------
// Configuration / constants
// ---------------------------------------------------------------------------

const MAX_TOKEN_CHARS = 4096;

/** Minimal logger contract — pino, console, etc. all satisfy this. */
export interface MiddlewareLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
}

export interface RequireAuthOptions {
  /** Optional structured logger for auth failures. Tokens are never logged. */
  logger?: MiddlewareLogger;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unauthorized(code: string, message = 'Authentication required'): ErrorEnvelope {
  return { error: { code, message } };
}

/**
 * Parse `Authorization: Bearer <token>`. Returns `null` for any malformed
 * value — we never attempt to be generous about formatting; a strict
 * parser is a smaller attack surface.
 */
function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const trimmed = headerValue.trim();
  // Single space separator, exactly two parts.
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return null;
  const scheme = trimmed.slice(0, spaceIdx);
  const token = trimmed.slice(spaceIdx + 1).trim();
  if (scheme.toLowerCase() !== 'bearer') return null;
  if (token.length === 0 || token.length > MAX_TOKEN_CHARS) return null;
  // Quick structural check: a JWS compact serialization has exactly two dots.
  if (token.split('.').length !== 3) return null;
  return token;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Express middleware that requires a valid JWT.
 *
 * Usage:
 *   app.get('/me', requireAuth(), (req, res) => res.json({ data: req.user }));
 *
 * On success: attaches {@link AuthUser} to `req.user` and calls `next()`.
 * On failure: responds with `401` and a structured error envelope. `next`
 * is NOT called on failure — downstream middleware/handlers do not run.
 */
export function requireAuth(options: RequireAuthOptions = {}): RequestHandler {
  return function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Express normalizes header names to lowercase.
    const authHeader = req.headers.authorization;
    const token = extractBearerToken(authHeader);

    if (!token) {
      options.logger?.warn(
        { path: req.path, reason: 'missing_or_malformed_header' },
        'auth: rejected request'
      );
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer realm="api", error="invalid_request"')
        .json(unauthorized('MISSING_TOKEN', 'Authentication required'));
      return;
    }

    const result = verifyToken(token);

    if (!result.ok) {
      // Distinct codes (machine-readable) but uniform message (human-readable).
      const code =
        result.reason === 'expired'
          ? 'TOKEN_EXPIRED'
          : result.reason === 'misconfigured'
            ? 'AUTH_MISCONFIGURED'
            : 'INVALID_TOKEN';

      // Never log the token. Log only a short prefix for correlation.
      options.logger?.warn(
        {
          path: req.path,
          reason: result.reason,
          tokenPrefix: token.slice(0, 6),
        },
        'auth: token verification failed'
      );

      // Misconfiguration is a 500-class problem, not a client problem.
      if (result.reason === 'misconfigured') {
        res.status(500).json({
          error: {
            code: 'AUTH_MISCONFIGURED',
            message: 'Authentication is temporarily unavailable',
          },
        } satisfies ErrorEnvelope);
        return;
      }

      res
        .status(401)
        .set(
          'WWW-Authenticate',
          `Bearer realm="api", error="invalid_token", error_description="${
            result.reason === 'expired' ? 'token expired' : 'invalid token'
          }"`
        )
        .json(unauthorized(code, 'Authentication required'));
      return;
    }

    // Token is valid — populate req.user from the claims.
    const user: AuthUser = {
      id: result.payload.sub,
      email: result.payload.email,
      tokenIssuedAt: result.payload.iat,
      tokenExpiresAt: result.payload.exp,
    };
    req.user = user;
    next();
  };
}

export default requireAuth;
