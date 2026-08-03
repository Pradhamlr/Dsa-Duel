import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import bcrypt from 'bcrypt';

const { default: app } = await import('../app.js');
const { prisma, resetDb, seedProblems } = await import('./dbHelpers.js');
const { redis, ensureRedisConnected } = await import('../utils/redisClient.js');
const { assertSafeTestRedis } = await import('../utils/dbSafety.js');

const PASSWORD = 'TestPass123!';

async function createVerifiedUser(email) {
  return prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      password: await bcrypt.hash(PASSWORD, 10),
      name: email.split('@')[0],
      emailVerified: true
    }
  });
}

async function loginAndGetToken(email) {
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}

const authed = (token) => (req) => req.set('Authorization', `Bearer ${token}`);

beforeEach(async () => {
  await resetDb();
  assertSafeTestRedis();
  await ensureRedisConnected();
  await redis.flushdb();
});

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe('create -> start -> mark', () => {
  it('creates a contest with settings only (no problems until Start), then Start picks them', async () => {
    await createVerifiedUser('creator@example.com');
    const token = await loginAndGetToken('creator@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy', finalTags: ['Array'] });

    const createRes = await authed(token)(request(app).post('/create-contest')).send({
      numProblems: 3,
      difficulty: 'Easy',
      selectedTopics: [],
      duration: 3600
    });
    expect(createRes.status).toBe(200);
    const { contestId } = createRes.body;
    expect(contestId).toBeTruthy();

    const beforeStart = await request(app).get(`/contest/${contestId}`);
    expect(beforeStart.status).toBe(200);
    expect(beforeStart.body.problems).toEqual([]);
    expect(beforeStart.body.startTime).toBeNull();
    expect(beforeStart.body.creatorId).toBeTruthy();

    const startRes = await authed(token)(request(app).post(`/contest/${contestId}/start`)).send({});
    expect(startRes.status).toBe(200);
    expect(startRes.body.contest.problems).toHaveLength(3);
    expect(startRes.body.contest.startTime).toBeTruthy();
    // Regression check: buildContestResponse must include creatorId/creatorName in
    // every broadcast-shaped response, not just the one-time GET -- a real bug once
    // made the Start Contest button visible to non-creators because this went missing.
    expect(startRes.body.contest.creatorId).toBeTruthy();
  });

  it('rejects starting a contest twice', async () => {
    await createVerifiedUser('creator2@example.com');
    const token = await loginAndGetToken('creator2@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const { body: { contestId } } = await authed(token)(request(app).post('/create-contest')).send({
      numProblems: 3, difficulty: 'Easy', selectedTopics: []
    });
    await authed(token)(request(app).post(`/contest/${contestId}/start`)).send({});

    const secondStart = await authed(token)(request(app).post(`/contest/${contestId}/start`)).send({});
    expect(secondStart.status).toBe(400);
  });

  it('only lets the creator start the contest', async () => {
    await createVerifiedUser('creator3@example.com');
    await createVerifiedUser('rando@example.com');
    const creatorToken = await loginAndGetToken('creator3@example.com');
    const randoToken = await loginAndGetToken('rando@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const { body: { contestId } } = await authed(creatorToken)(request(app).post('/create-contest')).send({
      numProblems: 3, difficulty: 'Easy', selectedTopics: []
    });

    const res = await authed(randoToken)(request(app).post(`/contest/${contestId}/start`)).send({});
    expect(res.status).toBe(403);

    // Confirming the creator can still start it afterward -- the rejection above was
    // specific to the wrong user, not a broken contest.
    const creatorStart = await authed(creatorToken)(request(app).post(`/contest/${contestId}/start`)).send({});
    expect(creatorStart.status).toBe(200);
  });

  it('marks a problem solved, reflects it in results, and records it in solve history', async () => {
    const creator = await createVerifiedUser('marker@example.com');
    const token = await loginAndGetToken('marker@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const { body: { contestId } } = await authed(token)(request(app).post('/create-contest')).send({
      numProblems: 3, difficulty: 'Easy', selectedTopics: []
    });
    await authed(token)(request(app).post(`/contest/${contestId}/start`)).send({});

    const markRes = await authed(token)(request(app).post(`/contest/${contestId}/mark`)).send({
      problemIndex: 0, solved: true
    });
    expect(markRes.status).toBe(200);
    expect(markRes.body.contest.results[creator.id].solved[0]).toBe(true);

    const contestAfter = await prisma.contest.findUnique({ where: { id: contestId } });
    const slug = contestAfter.problems[0].slug;
    const problem = await prisma.problem.findUnique({ where: { leetcodeId: slug } });
    const solvedRow = await prisma.solvedProblem.findUnique({
      where: { userId_problemId: { userId: creator.id, problemId: problem.id } }
    });
    expect(solvedRow.status).toBe('solved');
  });

  it('rejects contest creation with an invalid difficulty', async () => {
    await createVerifiedUser('validation@example.com');
    const token = await loginAndGetToken('validation@example.com');

    const res = await authed(token)(request(app).post('/create-contest')).send({
      numProblems: 3, difficulty: 'Impossible', selectedTopics: []
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication to create a contest', async () => {
    const res = await request(app).post('/create-contest').send({ numProblems: 3, difficulty: 'Easy' });
    expect(res.status).toBe(401);
  });
});

describe('create-contest rate limiting', () => {
  it('429s once the per-user attempt cap is exceeded within the window', async () => {
    await createVerifiedUser('spammer@example.com');
    const token = await loginAndGetToken('spammer@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const statuses = [];
    for (let i = 0; i < 21; i++) {
      const res = await authed(token)(request(app).post('/create-contest')).send({
        numProblems: 3, difficulty: 'Easy', selectedTopics: []
      });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it('does not rate-limit two different users independently', async () => {
    await createVerifiedUser('user-a@example.com');
    await createVerifiedUser('user-b@example.com');
    const tokenA = await loginAndGetToken('user-a@example.com');
    const tokenB = await loginAndGetToken('user-b@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    // Exhaust user A's own bucket -- keyed per-user, so this should have zero effect on
    // user B's ability to create a contest right after.
    for (let i = 0; i < 20; i++) {
      await authed(tokenA)(request(app).post('/create-contest')).send({
        numProblems: 3, difficulty: 'Easy', selectedTopics: []
      });
    }

    const bRes = await authed(tokenB)(request(app).post('/create-contest')).send({
      numProblems: 3, difficulty: 'Easy', selectedTopics: []
    });
    expect(bRes.status).toBe(200);
  });
});
