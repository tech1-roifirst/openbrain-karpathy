/**
 * POST /login — Unit Tests
 *
 * Six scenarios per the task spec, plus a few defense-in-depth assertions
 * (uniform message between unknown-user and wrong-password, no token
 * leaks in error responses, JWT contains correct claims).
 *
 * Test runner: Jest 29+ (or Vitest, with the `jest -> vi` alias).
 *
 * Author: joey-fullstack-backend
 * Task:   karpathy task-03 (Authentication Flow / JWT)
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { createLoginHandler } from './login';
import { requireAuth } from '../middleware/auth';
import { hashPassword } from '../utils/password';
import { generateToken, verifyToken } from '../utils/jwt';
import type { UserRecord, UserRepository } from '../types/auth';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

/**
 * In-memory UserRepository fixture. Tests inject the rows they need;
 * `findByEmail` returns null for any other email.
 */
class InMemoryUserRepository implements UserRepository {
  private byEmail = new Map<string, UserRecord>();

  add(user: UserRecord): void {
    this.byEmail.set(user.email.toLowerCase(), user);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.byEmail.get(email.toLowerCase()) ?? null;
  }
}

/** Builds a fresh Express app with /login and a /me protected route. */
async function buildApp(repo: UserRepository): Promise<Express> {
  const app = express();
  app.use(express.json());
  app.post('/login', createLoginHandler({ repository: repo }));
  app.get('/me', requireAuth(), (req, res) => {
    res.status(200).json({ data: { user: req.user } });
  });
  return app;
}

const VALID_EMAIL = 'jane@example.com';
const VALID_PASSWORD = 'correct horse battery staple';
const USER_ID = '11111111-1111-1111-1111-111111111111';

// ---------------------------------------------------------------------------
// Environment — set BEFORE importing modules that read it. Because the JWT
// utility loads the secret at call time (not module load), setting it in
// beforeAll is sufficient.
// ---------------------------------------------------------------------------

beforeAll(() => {
  process.env.JWT_SECRET =
    'test-secret-please-do-not-use-in-production-32chars+';
  process.env.NODE_ENV = 'test';
  // Use the minimum-allowed bcrypt cost in tests to keep the suite fast.
  // The password utility clamps anything below 12 up to 12, so this
  // documents intent — the actual cost will be 12.
  process.env.BCRYPT_COST = '12';
  process.env.TOKEN_EXPIRY_SECONDS = '3600';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /login', () => {
  let repo: InMemoryUserRepository;
  let app: Express;

  beforeEach(async () => {
    repo = new InMemoryUserRepository();
    const passwordHash = await hashPassword(VALID_PASSWORD);
    repo.add({
      id: USER_ID,
      email: VALID_EMAIL,
      password_hash: passwordHash,
    });
    app = await buildApp(repo);
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Valid credentials → 200 with JWT token
  // -------------------------------------------------------------------------
  it('returns 200 + JWT token for valid credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toMatchObject({
      data: {
        token: expect.any(String),
        expiresIn: 3600,
        user: { id: USER_ID, email: VALID_EMAIL },
      },
    });

    // Response must NOT cache the token.
    expect(res.headers['cache-control']).toMatch(/no-store/);

    // The token must be a verifiable JWT with the expected claims.
    const verified = verifyToken(res.body.data.token);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.sub).toBe(USER_ID);
      expect(verified.payload.email).toBe(VALID_EMAIL);
      // exp - iat must equal the configured lifetime.
      expect(verified.payload.exp - verified.payload.iat).toBe(3600);
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Wrong password → 401 with generic message
  // -------------------------------------------------------------------------
  it('returns 401 with generic message for wrong password', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: VALID_EMAIL, password: 'definitely-wrong' })
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    });
    // Negative assertion: response must not include a token field.
    expect(res.body).not.toHaveProperty('data');
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
  });

  // -------------------------------------------------------------------------
  // Scenario 3: User not found → 401 with SAME generic message as wrong password
  // -------------------------------------------------------------------------
  it('returns 401 with the same generic message for unknown user', async () => {
    const wrongPasswordRes = await request(app)
      .post('/login')
      .send({ email: VALID_EMAIL, password: 'definitely-wrong' })
      .expect(401);

    const unknownUserRes = await request(app)
      .post('/login')
      .send({ email: 'nobody@example.com', password: 'whatever' })
      .expect(401);

    // Status, code, and message must be byte-for-byte identical.
    expect(unknownUserRes.body).toEqual(wrongPasswordRes.body);
    expect(unknownUserRes.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownUserRes.body.error.message).toBe('Invalid email or password');
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Missing email → 400 Bad Request
  // -------------------------------------------------------------------------
  it('returns 400 when email field is missing', async () => {
    const res = await request(app)
      .post('/login')
      .send({ password: VALID_PASSWORD })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
      ])
    );
  });

  it('returns 400 when email is an empty string', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: '', password: VALID_PASSWORD })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Missing password → 400 Bad Request
  // -------------------------------------------------------------------------
  it('returns 400 when password field is missing', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: VALID_EMAIL })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'password' }),
      ])
    );
  });

  it('returns 400 when password is an empty string', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: VALID_EMAIL, password: '' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // -------------------------------------------------------------------------
  // Scenario 6: JWT validates correctly when passed to a protected endpoint
  // -------------------------------------------------------------------------
  it('issued token authorizes the protected /me endpoint via auth middleware', async () => {
    const loginRes = await request(app)
      .post('/login')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD })
      .expect(200);

    const token = loginRes.body.data.token as string;
    expect(token).toEqual(expect.any(String));

    const meRes = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meRes.body.data.user).toMatchObject({
      id: USER_ID,
      email: VALID_EMAIL,
    });
    // Confirms the middleware populated tokenIssuedAt / tokenExpiresAt.
    expect(typeof meRes.body.data.user.tokenIssuedAt).toBe('number');
    expect(typeof meRes.body.data.user.tokenExpiresAt).toBe('number');
    expect(
      meRes.body.data.user.tokenExpiresAt -
        meRes.body.data.user.tokenIssuedAt
    ).toBe(3600);
  });

  // -------------------------------------------------------------------------
  // Defense-in-depth assertions
  // -------------------------------------------------------------------------

  it('rejects /me without a token (401)', async () => {
    const res = await request(app).get('/me').expect(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('rejects /me with a tampered token (401)', async () => {
    const loginRes = await request(app)
      .post('/login')
      .send({ email: VALID_EMAIL, password: VALID_PASSWORD })
      .expect(200);
    const token = loginRes.body.data.token as string;
    // Flip the last character of the signature segment.
    const parts = token.split('.');
    const sig = parts[2] || '';
    const tampered = `${parts[0]}.${parts[1]}.${
      sig.slice(0, -1) + (sig.slice(-1) === 'A' ? 'B' : 'A')
    }`;
    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token (401 TOKEN_EXPIRED)', async () => {
    // Mint a token that is already expired by issuing with a 1-second
    // lifetime, then advancing the system clock past it.
    const original = generateToken(USER_ID, VALID_EMAIL, 1);
    // 2-second wait would slow the suite; instead, we advance by patching
    // Date.now temporarily.
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 5_000;
      const res = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${original.token}`)
        .expect(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    } finally {
      Date.now = realNow;
    }
  });

  it('email is normalized (case-insensitive lookup, trimmed)', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: '  JANE@EXAMPLE.COM  ', password: VALID_PASSWORD })
      .expect(200);
    expect(res.body.data.user.email).toBe(VALID_EMAIL);
  });

  it('does not differ in response shape between user-not-found and wrong-password', async () => {
    // The two failure modes must be indistinguishable to the client.
    const a = await request(app)
      .post('/login')
      .send({ email: VALID_EMAIL, password: 'wrong' });
    const b = await request(app)
      .post('/login')
      .send({ email: 'ghost@example.com', password: 'wrong' });
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
  });
});
