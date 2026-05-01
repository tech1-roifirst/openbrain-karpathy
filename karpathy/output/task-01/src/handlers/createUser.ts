/**
 * POST /users — Create User Handler
 *
 * Production-ready Express.js + TypeScript handler.
 * Implements input validation (Zod), proper HTTP semantics (201/400/409),
 * structured error responses with field-level details, parameterized DB
 * access (no string interpolation), and environment-driven configuration.
 *
 * Author: dan-backend-engineer
 * Task:   karpathy task-01 (REST API with Validation)
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Persisted User shape returned to clients. */
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string; // ISO-8601
}

/** Field-level validation error detail. */
export interface FieldError {
  field: string;
  message: string;
}

/** Standard error envelope. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: FieldError[];
  };
}

/** Standard success envelope. */
export interface SuccessEnvelope<T> {
  data: T;
}

// ---------------------------------------------------------------------------
// Repository contract — injectable so the handler is testable and DB-agnostic
// ---------------------------------------------------------------------------

export interface UserRepository {
  /** Returns true if a user with the given email already exists. */
  existsByEmail(email: string): Promise<boolean>;

  /**
   * Inserts a new user. Implementations MUST use parameterized queries
   * (prepared statements) to prevent SQL injection. Implementations MAY
   * throw a `DuplicateEmailError` if a unique-constraint race occurs
   * after the existence check (handled below as a 409).
   */
  insert(user: User): Promise<User>;
}

/** Sentinel error implementations may throw on a unique-constraint violation. */
export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`Email already exists: ${email}`);
    this.name = 'DuplicateEmailError';
  }
}

// ---------------------------------------------------------------------------
// Configuration — driven entirely by environment variables (no hardcoding)
// ---------------------------------------------------------------------------

interface HandlerConfig {
  /** Maximum allowed request body size, expressed in bytes. */
  maxBodyBytes: number;
  /** Whether to expose internal error messages (true in dev, false in prod). */
  exposeInternalErrors: boolean;
  /** Maximum length of the `name` field. */
  nameMaxLength: number;
  /** Maximum length of the `email` field (RFC 5321 practical limit is 254). */
  emailMaxLength: number;
}

function loadConfig(): HandlerConfig {
  const env = (key: string, fallback: string): string =>
    process.env[key] !== undefined && process.env[key] !== ''
      ? (process.env[key] as string)
      : fallback;

  const intEnv = (key: string, fallback: number): number => {
    const raw = process.env[key];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    maxBodyBytes: intEnv('USERS_API_MAX_BODY_BYTES', 1024 * 10), // 10 KiB default
    exposeInternalErrors: env('NODE_ENV', 'production').toLowerCase() !== 'production',
    nameMaxLength: intEnv('USERS_API_NAME_MAX_LENGTH', 100),
    emailMaxLength: intEnv('USERS_API_EMAIL_MAX_LENGTH', 254),
  };
}

// ---------------------------------------------------------------------------
// Validation schema (Zod)
// ---------------------------------------------------------------------------

function buildCreateUserSchema(cfg: HandlerConfig) {
  return z
    .object({
      email: z
        .string({
          required_error: 'email is required',
          invalid_type_error: 'email must be a string',
        })
        .trim()
        .min(1, 'email is required')
        .max(cfg.emailMaxLength, `email must be at most ${cfg.emailMaxLength} characters`)
        .email('email must be a valid email address')
        .transform((v) => v.toLowerCase()),
      name: z
        .string({
          required_error: 'name is required',
          invalid_type_error: 'name must be a string',
        })
        .trim()
        .min(1, 'name must be between 1 and ' + cfg.nameMaxLength + ' characters')
        .max(cfg.nameMaxLength, `name must be between 1 and ${cfg.nameMaxLength} characters`),
    })
    .strict(); // reject unknown fields — defense-in-depth against mass assignment
}

export type CreateUserInput = z.infer<ReturnType<typeof buildCreateUserSchema>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function badRequest(details: FieldError[], message = 'Invalid input provided'): ErrorEnvelope {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message,
      details,
    },
  };
}

function conflict(email: string): ErrorEnvelope {
  return {
    error: {
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'A user with this email address already exists',
      details: [{ field: 'email', message: `Email "${email}" is already registered` }],
    },
  };
}

function internalError(exposeMessage: boolean, err: unknown): ErrorEnvelope {
  const message =
    exposeMessage && err instanceof Error
      ? err.message
      : 'An unexpected error occurred. Please try again later.';
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  };
}

function zodErrorToFieldErrors(err: ZodError): FieldError[] {
  return err.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

/**
 * Creates a POST /users handler bound to the given repository.
 *
 * Usage:
 *   const router = express.Router();
 *   router.post('/users', express.json({ limit: '10kb' }), createUserHandler(repo));
 */
export function createUserHandler(repository: UserRepository): RequestHandler {
  const config = loadConfig();
  const schema = buildCreateUserSchema(config);

  return async function handle(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    // Defense-in-depth: enforce JSON content-type at the boundary.
    const contentType = (req.headers['content-type'] || '').toString().toLowerCase();
    if (!contentType.includes('application/json')) {
      res.status(415).json({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Content-Type must be application/json',
        },
      } satisfies ErrorEnvelope);
      return;
    }

    // 1) Validate input
    let input: CreateUserInput;
    try {
      input = schema.parse(req.body);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json(badRequest(zodErrorToFieldErrors(err)));
        return;
      }
      // Non-Zod error during parse — treat as bad request (malformed payload).
      res.status(400).json(
        badRequest([{ field: '(root)', message: 'Request body could not be parsed' }])
      );
      return;
    }

    // 2) Pre-flight uniqueness check (best-effort; race is handled below).
    try {
      const exists = await repository.existsByEmail(input.email);
      if (exists) {
        res.status(409).json(conflict(input.email));
        return;
      }
    } catch (err) {
      // Surface as 500 — do not leak internal details unless explicitly enabled.
      res.status(500).json(internalError(config.exposeInternalErrors, err));
      return;
    }

    // 3) Build and persist the user
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      created_at: now,
    };

    try {
      const saved = await repository.insert(user);
      const body: SuccessEnvelope<User> = { data: saved };
      // 201 Created with Location header pointing to the new resource.
      res.status(201).location(`/users/${saved.id}`).json(body);
      return;
    } catch (err) {
      // Handle unique-constraint race (another insert won between check and write).
      if (err instanceof DuplicateEmailError) {
        res.status(409).json(conflict(input.email));
        return;
      }
      res.status(500).json(internalError(config.exposeInternalErrors, err));
      return;
    }
  };
}

// ---------------------------------------------------------------------------
// Default export — convenience for typical wiring
// ---------------------------------------------------------------------------

export default createUserHandler;
