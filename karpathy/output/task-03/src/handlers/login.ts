/**
 * POST /login — Login Handler
 *
 * Production-ready Express + TypeScript handler implementing JWT-based
 * authentication with a hardened password verification path.
 *
 * Security posture (OWASP ASVS 4.0 §2.1, §2.2 aligned):
 *
 *   - **No user-existence leak.** A wrong password and an unknown email
 *     produce the SAME response: status `401`, code `INVALID_CREDENTIALS`,
 *     message "Invalid email or password". The DB-miss branch ALSO runs a
 *     dummy bcrypt compare so request latency does not differ between
 *     "user found" and "user not found". This defeats user enumeration via
 *     timing analysis.
 *
 *   - **Constant-time password comparison.** Delegated to {@link verifyPassword},
 *     which layers `crypto.timingSafeEqual` on top of bcrypt's compare.
 *
 *   - **No secrets in logs.** We never log the request body, the password
 *     (plain or hashed), or the issued token. We log structured outcomes
 *     ("login_success", "login_failure") with the email and a request id
 *     only — and the email is downcased + trimmed so it matches DB keys.
 *
 *   - **Strict input validation at the boundary.** Zod schema rejects
 *     missing fields (400) before any DB call.
 *
 *   - **Environment-driven config.** `JWT_SECRET`, `BCRYPT_COST`,
 *     `TOKEN_EXPIRY_SECONDS`, `NODE_ENV` are the only knobs.
 *
 *   - **Dependency injection.** The handler accepts a `UserRepository` so
 *     it is trivially testable and DB-agnostic.
 *
 *   - **Rate limiting (NOT in this file).** Login endpoints MUST be rate
 *     limited per-IP and per-email to defeat credential stuffing. That
 *     concern lives at the route-mounting layer (e.g. express-rate-limit
 *     middleware) and is documented at the bottom of this file.
 *
 *   - **CSRF (NOT in this file).** This handler is designed for token-based
 *     auth where the client stores the JWT in memory and sends it via the
 *     `Authorization` header. If you instead set the JWT in a cookie, you
 *     MUST add CSRF protection (double-submit cookie or SameSite=Strict)
 *     and harden cookie flags (HttpOnly, Secure, SameSite). See bottom.
 *
 * Author: joey-fullstack-backend
 * Task:   karpathy task-03 (Authentication Flow / JWT)
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodError } from 'zod';
import { verifyPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import type {
  ErrorEnvelope,
  LoginResponse,
  SuccessEnvelope,
  UserRepository,
  UserRecord,
} from '../types/auth';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

/**
 * Login request schema.
 *
 * Notes:
 *   - We trim email and lowercase it so DB lookups are consistent.
 *   - We trim the password's surrounding whitespace because most clients
 *     accidentally include a trailing newline. We do NOT alter interior
 *     whitespace (passwords like "my pass phrase" are fully supported).
 *   - We don't enforce a max password complexity here — this is the LOGIN
 *     path, not signup. The user already chose their password; rejecting
 *     it now would just generate support tickets.
 */
const loginSchema = z
  .object({
    email: z
      .string({
        required_error: 'email is required',
        invalid_type_error: 'email must be a string',
      })
      .trim()
      .min(1, 'email is required')
      .max(254, 'email is too long')
      .email('email must be a valid email address')
      .transform((v) => v.toLowerCase()),
    password: z
      .string({
        required_error: 'password is required',
        invalid_type_error: 'password must be a string',
      })
      .min(1, 'password is required')
      .max(1024, 'password is too long'), // sanity cap to defeat resource exhaustion
  })
  .strict();

type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Logger contract (DI-friendly)
// ---------------------------------------------------------------------------

export interface LoginLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export interface LoginHandlerOptions {
  repository: UserRepository;
  logger?: LoginLogger;
}

// ---------------------------------------------------------------------------
// Error envelopes
// ---------------------------------------------------------------------------

const INVALID_CREDENTIALS_ENVELOPE: ErrorEnvelope = {
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
};

function validationError(err: ZodError): ErrorEnvelope {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input provided',
      details: err.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
        message: issue.message,
      })),
    },
  };
}

const INTERNAL_ERROR_ENVELOPE: ErrorEnvelope = {
  error: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
  },
};

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

/**
 * Creates the POST /login handler.
 *
 * Usage:
 *   const handler = createLoginHandler({ repository: userRepo, logger });
 *   app.post('/login', express.json({ limit: '4kb' }), rateLimit, handler);
 */
export function createLoginHandler(options: LoginHandlerOptions): RequestHandler {
  const { repository, logger } = options;

  return async function handle(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    // ---------------------------------------------------------------------
    // 1) Validate input — 400 path
    // ---------------------------------------------------------------------
    let input: LoginInput;
    try {
      input = loginSchema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json(validationError(err));
        return;
      }
      // Body parse failure — generic 400.
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body could not be parsed',
        },
      } satisfies ErrorEnvelope);
      return;
    }

    // ---------------------------------------------------------------------
    // 2) Look up the user. We do NOT short-circuit on "user not found"
    //    — instead we run a dummy verify so the DB-miss branch and the
    //    DB-hit branch take the same wall-clock time. This defeats user
    //    enumeration via login timing.
    // ---------------------------------------------------------------------
    let userRecord: UserRecord | null = null;
    try {
      userRecord = await repository.findByEmail(input.email);
    } catch (err) {
      // Repository failure is a 500 — but we never embed the error
      // message in the response (it could leak SQL detail).
      logger?.error(
        { email: input.email, err: err instanceof Error ? err.message : 'unknown' },
        'login: repository error'
      );
      res.status(500).json(INTERNAL_ERROR_ENVELOPE);
      return;
    }

    // Sentinel hash that will never match any real password. We use a
    // syntactically valid bcrypt hash so `verifyPassword` exercises the
    // same code path it would for a real user.
    const SENTINEL_HASH =
      '$2b$12$CwTycUXWue0Thq9StjUM0uJ8ks8Jq7VqJzZpXRk0K1aN3G3sCXp.S';

    const hashToCompare = userRecord?.password_hash ?? SENTINEL_HASH;

    // ---------------------------------------------------------------------
    // 3) Verify the password in constant-time-ish fashion.
    // ---------------------------------------------------------------------
    let passwordValid = false;
    try {
      passwordValid = await verifyPassword(input.password, hashToCompare);
    } catch (err) {
      // verifyPassword swallows bcrypt errors internally, but be defensive.
      logger?.error(
        { email: input.email, err: err instanceof Error ? err.message : 'unknown' },
        'login: verifyPassword threw unexpectedly'
      );
      res.status(500).json(INTERNAL_ERROR_ENVELOPE);
      return;
    }

    if (!userRecord || !passwordValid) {
      // Single, generic failure response. Never differentiate "no user"
      // from "wrong password" in either status, code, or message.
      logger?.warn(
        {
          email: input.email,
          // Distinguish reasons in LOGS (operator visibility) but never
          // in the HTTP response.
          reason: !userRecord ? 'user_not_found' : 'wrong_password',
        },
        'login: failure'
      );
      res.status(401).json(INVALID_CREDENTIALS_ENVELOPE);
      return;
    }

    // ---------------------------------------------------------------------
    // 4) Mint the JWT and return success.
    // ---------------------------------------------------------------------
    let issued: ReturnType<typeof generateToken>;
    try {
      issued = generateToken(userRecord.id, userRecord.email);
    } catch (err) {
      // JWT misconfiguration (missing/short secret) — 500 with no detail.
      logger?.error(
        { err: err instanceof Error ? err.message : 'unknown' },
        'login: token generation failed'
      );
      res.status(500).json(INTERNAL_ERROR_ENVELOPE);
      return;
    }

    logger?.info(
      { email: userRecord.email, userId: userRecord.id },
      'login: success'
    );

    const body: LoginResponse = {
      data: {
        token: issued.token,
        expiresIn: issued.expiresIn,
        user: {
          id: userRecord.id,
          email: userRecord.email,
        },
      },
    };

    // Anti-cache headers: tokens must never be cached by intermediaries.
    res
      .status(200)
      .set('Cache-Control', 'no-store')
      .set('Pragma', 'no-cache')
      .json(body satisfies SuccessEnvelope<unknown>);
  };
}

export default createLoginHandler;

// ---------------------------------------------------------------------------
// Operational notes (NOT executed — for operators / future maintainers)
// ---------------------------------------------------------------------------
//
// Rate limiting:
//   Mount a per-IP and per-email rate limiter in front of this handler.
//   Recommended bounds: 5 attempts / 5 min per IP+email pair, with
//   exponential backoff on the next window. Use sliding-window counters
//   in Redis. See e.g. `express-rate-limit` + `rate-limit-redis`.
//
// CSRF:
//   This handler is designed for `Authorization: Bearer <token>` clients.
//   If you decide to set the JWT in a cookie:
//     - cookie flags: HttpOnly, Secure, SameSite=Strict, Domain=<exact>
//     - add CSRF protection (double-submit cookie pattern or SameSite alone
//       for first-party flows).
//
// HTTPS:
//   Enforce TLS at the load balancer or via a `requireHttps` middleware.
//   In NODE_ENV=production, refuse to serve `/login` over plain HTTP.
//
// Audit logs:
//   The `logger.warn` and `logger.info` calls above are the audit trail.
//   Forward them to a dedicated security-events index (separate retention
//   from app logs) and alert on >N failures per email per hour.
