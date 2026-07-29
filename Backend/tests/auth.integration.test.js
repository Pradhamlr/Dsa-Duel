import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import bcrypt from 'bcrypt';

// Register sends a real email via nodemailer in production -- mocked here so these
// tests never touch a real inbox (the established rule: never hit a real email path
// with fake addresses, even in a test). Declared before importing app.js so every
// module that imports sendEmail.js -- including transitively -- gets the mock.
vi.mock('../utils/sendEmail.js', () => ({ sendEmail: vi.fn() }));

const { default: app } = await import('../app.js');
const { sendEmail } = await import('../utils/sendEmail.js');
const { prisma, resetDb } = await import('./dbHelpers.js');
const { redis, ensureRedisConnected } = await import('../utils/redisClient.js');

const PASSWORD = 'TestPass123!';

async function createVerifiedUser({ email, password = PASSWORD }) {
  return prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      password: await bcrypt.hash(password, 10),
      name: 'Test User',
      emailVerified: true
    }
  });
}

beforeEach(async () => {
  await resetDb();
  sendEmail.mockClear();
  // Flush rate-limit counters and denylist entries so one test's attempts never bleed
  // into the next's -- this Redis instance only ever exists for this test run.
  await ensureRedisConnected();
  await redis.flushdb();
});

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe('register -> verify-email', () => {
  it('registers, emails an OTP, and verify-email logs the new user straight in', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'newuser@example.com',
      password: PASSWORD,
      name: 'New User'
    });
    expect(res.status).toBe(201);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const [, , emailBody] = sendEmail.mock.calls[0];
    const otp = emailBody.match(/\d{6}/)[0];

    const verifyRes = await request(app).post('/auth/verify-email').send({ email: 'newuser@example.com', otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.accessToken).toBeTruthy();
    expect(verifyRes.body.user.email).toBe('newuser@example.com');
  });

  it('rejects a wrong OTP and leaves the account unverified', async () => {
    await request(app).post('/auth/register').send({ email: 'wrongotp@example.com', password: PASSWORD });
    const res = await request(app).post('/auth/verify-email').send({ email: 'wrongotp@example.com', otp: '000000' });
    expect(res.status).toBe(400);

    const loginRes = await request(app).post('/auth/login').send({ email: 'wrongotp@example.com', password: PASSWORD });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects registering the same email twice', async () => {
    await request(app).post('/auth/register').send({ email: 'dupe@example.com', password: PASSWORD });
    const res = await request(app).post('/auth/register').send({ email: 'dupe@example.com', password: PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('USER_ALREADY_EXISTS');
  });
});

describe('login', () => {
  it('logs in a verified user with an access token and a refresh cookie', async () => {
    await createVerifiedUser({ email: 'login@example.com' });
    const res = await request(app).post('/auth/login').send({ email: 'login@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.[0]).toMatch(/duel_refresh_token=/);
  });

  it('rejects login for an unverified account even with the correct password', async () => {
    await prisma.user.create({
      data: { id: randomUUID(), email: 'unverified@example.com', password: await bcrypt.hash(PASSWORD, 10) }
    });
    const res = await request(app).post('/auth/login').send({ email: 'unverified@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects a wrong password', async () => {
    await createVerifiedUser({ email: 'wrongpass@example.com' });
    const res = await request(app).post('/auth/login').send({ email: 'wrongpass@example.com', password: 'WrongPass123!' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('refresh rotation and reuse detection', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    await createVerifiedUser({ email: 'refresh@example.com' });
    const agent = request.agent(app);
    const loginRes = await agent.post('/auth/login').send({ email: 'refresh@example.com', password: PASSWORD });

    const refreshRes = await agent.post('/auth/refresh-token').send();
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
    // Not asserting the access token STRING differs from login's: if both are signed
    // within the same wall-clock second for the same session, the JWT payload (incl.
    // `iat`) is byte-identical, so the signature is too -- that's expected, not a bug.
    // What must be true is that it decodes to the same session (rotation doesn't start
    // a new session, it just issues a new refresh secret for the existing one).
    const decoded = JSON.parse(Buffer.from(refreshRes.body.accessToken.split('.')[1], 'base64url').toString());
    const decodedOriginal = JSON.parse(Buffer.from(loginRes.body.accessToken.split('.')[1], 'base64url').toString());
    expect(decoded.sid).toBe(decodedOriginal.sid);
  });

  it('detects reuse of an already-rotated-past refresh token and revokes the session', async () => {
    await createVerifiedUser({ email: 'reuse@example.com' });
    const agent = request.agent(app);
    const loginRes = await agent.post('/auth/login').send({ email: 'reuse@example.com', password: PASSWORD });
    const originalCookie = loginRes.headers['set-cookie'][0];

    // Rotate twice -- the original login token is now two generations behind, so it's
    // neither the current hash nor the one-generation-back "grace" hash sessionService
    // tolerates for race conditions. Replaying it must look like theft, not a race.
    await agent.post('/auth/refresh-token').send();
    await agent.post('/auth/refresh-token').send();

    const reuseRes = await request(app).post('/auth/refresh-token').set('Cookie', originalCookie).send();
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.code).toBe('SESSION_REVOKED');

    // The whole family was revoked, not just this one attempt -- the legitimate agent's
    // now-current refresh token must also be dead.
    const legitimateRetry = await agent.post('/auth/refresh-token').send();
    expect(legitimateRetry.status).toBe(401);
  });
});

describe('logout and the access-token denylist', () => {
  it('denylists the still-unexpired access token immediately on logout', async () => {
    await createVerifiedUser({ email: 'logout@example.com' });
    const agent = request.agent(app);
    const loginRes = await agent.post('/auth/login').send({ email: 'logout@example.com', password: PASSWORD });
    const accessToken = loginRes.body.accessToken;

    const meBefore = await request(app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(meBefore.status).toBe(200);

    const logoutRes = await agent.post('/auth/logout').set('Authorization', `Bearer ${accessToken}`);
    expect(logoutRes.status).toBe(200);

    // Same still-JWT-valid token, right after logout -- must be rejected now, not in 15
    // minutes when it would have expired anyway.
    const meAfter = await request(app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(meAfter.status).toBe(401);
    expect(meAfter.body.code).toBe('SESSION_REVOKED');
  });
});

describe('login rate limiting', () => {
  it('429s once the per-IP attempt cap is exceeded within the window', async () => {
    await createVerifiedUser({ email: 'ratelimit@example.com' });

    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app).post('/auth/login').send({ email: 'ratelimit@example.com', password: 'WrongPass123!' });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});
