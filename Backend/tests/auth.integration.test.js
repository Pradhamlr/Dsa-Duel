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
const { assertSafeTestRedis } = await import('../utils/dbSafety.js');

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
  assertSafeTestRedis();
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

  // A wrong OTP no longer leaves a real, permanently-unverified User row -- under the
  // pending-registration-in-Redis redesign, nothing was ever created in Postgres in the
  // first place, so there's no account to be "unverified." login() correctly falls
  // through to its no-such-user branch (401 INVALID_CREDENTIALS), not the old
  // EMAIL_NOT_VERIFIED case, which can no longer be reached via a failed OTP attempt.
  it('rejects a wrong OTP and never creates a real account', async () => {
    await request(app).post('/auth/register').send({ email: 'wrongotp@example.com', password: PASSWORD });
    const res = await request(app).post('/auth/verify-email').send({ email: 'wrongotp@example.com', otp: '000000' });
    expect(res.status).toBe(400);

    const dbUser = await prisma.user.findUnique({ where: { email: 'wrongotp@example.com' } });
    expect(dbUser).toBeNull();

    const loginRes = await request(app).post('/auth/login').send({ email: 'wrongotp@example.com', password: PASSWORD });
    expect(loginRes.status).toBe(401);
    expect(loginRes.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects registering an email that is already a real, verified account', async () => {
    await createVerifiedUser({ email: 'realuser@example.com' });
    const res = await request(app).post('/auth/register').send({ email: 'realuser@example.com', password: PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('USER_ALREADY_EXISTS');
  });

  // The core point of the redesign: registering again with the same still-unverified
  // email is not an error at all -- it's the same thing as pressing "resend," since
  // nothing permanent existed yet to collide with. The old OTP must stop working the
  // moment the new one is issued (the pending Redis entry is fully overwritten, not
  // appended to), and the new one must work.
  it('lets registering the same still-pending email again overwrite the OTP, not conflict', async () => {
    await request(app).post('/auth/register').send({ email: 'pending@example.com', password: PASSWORD });
    const firstOtp = sendEmail.mock.calls[0][2].match(/\d{6}/)[0];

    const secondRes = await request(app).post('/auth/register').send({ email: 'pending@example.com', password: PASSWORD });
    expect(secondRes.status).toBe(201);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const secondOtp = sendEmail.mock.calls[1][2].match(/\d{6}/)[0];

    const oldOtpRes = await request(app).post('/auth/verify-email').send({ email: 'pending@example.com', otp: firstOtp });
    expect(oldOtpRes.status).toBe(400);

    const newOtpRes = await request(app).post('/auth/verify-email').send({ email: 'pending@example.com', otp: secondOtp });
    expect(newOtpRes.status).toBe(200);
    expect(newOtpRes.body.user.email).toBe('pending@example.com');
  });

  // A registration nobody ever verifies must not leave a permanent trace -- this is the
  // actual bug the whole redesign fixes, so it's worth asserting directly rather than
  // only through the "can register again" behavior above.
  it('leaves no User row behind for an abandoned, never-verified registration', async () => {
    await request(app).post('/auth/register').send({ email: 'abandoned@example.com', password: PASSWORD });
    const dbUser = await prisma.user.findUnique({ where: { email: 'abandoned@example.com' } });
    expect(dbUser).toBeNull();
  });
});

describe('resend-verification', () => {
  it('resends a fresh code that works, while the original code stops working', async () => {
    await request(app).post('/auth/register').send({ email: 'resend@example.com', password: PASSWORD });
    const firstOtp = sendEmail.mock.calls[0][2].match(/\d{6}/)[0];

    const resendRes = await request(app).post('/auth/resend-verification').send({ email: 'resend@example.com' });
    expect(resendRes.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const secondOtp = sendEmail.mock.calls[1][2].match(/\d{6}/)[0];

    const oldOtpRes = await request(app).post('/auth/verify-email').send({ email: 'resend@example.com', otp: firstOtp });
    expect(oldOtpRes.status).toBe(400);

    const newOtpRes = await request(app).post('/auth/verify-email').send({ email: 'resend@example.com', otp: secondOtp });
    expect(newOtpRes.status).toBe(200);
  });

  // Enumeration-safe, same as forgotPassword: identical response and no email sent,
  // whether there's genuinely no pending registration for that address or (below) it's
  // already a real verified account.
  it('returns the same generic response and sends nothing for an unknown email', async () => {
    const res = await request(app).post('/auth/resend-verification').send({ email: 'nobodyhere@example.com' });
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns the same generic response and sends nothing for an already-verified account', async () => {
    await createVerifiedUser({ email: 'alreadyverified@example.com' });
    const res = await request(app).post('/auth/resend-verification').send({ email: 'alreadyverified@example.com' });
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('concurrent pending registrations racing on username', () => {
  // Each pending registration lives independently in Redis, keyed by email -- so two
  // different people can be mid-registration with the same username at once, something
  // register()'s own pre-check can no longer fully prevent (that check only looks at
  // real Postgres rows). Whoever verifies first wins the username; the second must get
  // a clear, specific conflict rather than an unhandled 500 from Prisma's raw unique-
  // constraint error.
  it('lets the first verifier win a contested username and gives the second a clear conflict', async () => {
    await request(app).post('/auth/register').send({ email: 'racer1@example.com', username: 'sharedname', password: PASSWORD });
    const otp1 = sendEmail.mock.calls[0][2].match(/\d{6}/)[0];

    await request(app).post('/auth/register').send({ email: 'racer2@example.com', username: 'sharedname', password: PASSWORD });
    const otp2 = sendEmail.mock.calls[1][2].match(/\d{6}/)[0];

    const firstVerify = await request(app).post('/auth/verify-email').send({ email: 'racer1@example.com', otp: otp1 });
    expect(firstVerify.status).toBe(200);

    const secondVerify = await request(app).post('/auth/verify-email').send({ email: 'racer2@example.com', otp: otp2 });
    expect(secondVerify.status).toBe(409);
    expect(secondVerify.body.code).toBe('REGISTRATION_CONFLICT');
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
