import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import bcrypt from 'bcrypt';

// verifyLeetCodeSubmission hits the real LeetCode GraphQL API otherwise -- mocked so
// these tests never depend on a real external service (or a real LeetCode account's
// actual submission history). Declared before importing app.js so every module that
// imports leetcode.js -- including contestController.js transitively -- gets the mock.
// problemIngestion.js (used by the createContest/startContest tests already in this
// file) does not import from leetcode.js, so mocking it here doesn't touch that path.
vi.mock('../utils/leetcode.js', () => ({ fetchRecentAcSubmissions: vi.fn() }));

const { default: app } = await import('../app.js');
const { fetchRecentAcSubmissions } = await import('../utils/leetcode.js');
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
  fetchRecentAcSubmissions.mockReset();
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

describe('leetcode verification', () => {
  async function setupStartedContest(email) {
    const user = await createVerifiedUser(email);
    const token = await loginAndGetToken(email);
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const { body: { contestId } } = await authed(token)(request(app).post('/create-contest')).send({
      numProblems: 3, difficulty: 'Easy', selectedTopics: []
    });
    await authed(token)(request(app).post(`/contest/${contestId}/start`)).send({});

    const contest = await prisma.contest.findUnique({ where: { id: contestId } });
    return { user, token, contestId, contest };
  }

  it('rejects verification when the user has no LeetCode username set', async () => {
    const { token, contestId } = await setupStartedContest('nolcusername@example.com');

    const res = await authed(token)(request(app).post(`/contest/${contestId}/verify-leetcode`)).send({ problemIndex: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LEETCODE_USERNAME_NOT_SET');
    expect(fetchRecentAcSubmissions).not.toHaveBeenCalled();
  });

  it('returns verified:false and marks nothing solved when no matching submission is found', async () => {
    const { user, token, contestId } = await setupStartedContest('nomatch@example.com');
    await prisma.user.update({ where: { id: user.id }, data: { leetcodeUsername: 'someuser' } });

    fetchRecentAcSubmissions.mockResolvedValueOnce([
      { titleSlug: 'some-other-problem', timestamp: String(Math.floor(Date.now() / 1000)) }
    ]);

    const res = await authed(token)(request(app).post(`/contest/${contestId}/verify-leetcode`)).send({ problemIndex: 0 });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);

    const result = await prisma.result.findFirst({ where: { contestId, userId: user.id, problemIndex: 0 } });
    expect(result).toBeNull();
  });

  it('verifies and marks solved when a matching submission after contest start is found', async () => {
    const { user, token, contestId, contest } = await setupStartedContest('match@example.com');
    await prisma.user.update({ where: { id: user.id }, data: { leetcodeUsername: 'someuser' } });

    const slug = contest.problems[0].slug;
    const afterStartTimestamp = Math.floor((contest.startTime.getTime() + 60 * 1000) / 1000);
    fetchRecentAcSubmissions.mockResolvedValueOnce([
      { titleSlug: slug, timestamp: String(afterStartTimestamp) }
    ]);

    const res = await authed(token)(request(app).post(`/contest/${contestId}/verify-leetcode`)).send({ problemIndex: 0 });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);

    const result = await prisma.result.findFirst({ where: { contestId, userId: user.id, problemIndex: 0 } });
    expect(result.solvedAt).not.toBeNull();
    expect(result.verifiedVia).toBe('leetcode');

    const problem = await prisma.problem.findUnique({ where: { leetcodeId: slug } });
    const solvedRow = await prisma.solvedProblem.findUnique({
      where: { userId_problemId: { userId: user.id, problemId: problem.id } }
    });
    expect(solvedRow.status).toBe('solved');
  });

  // The entire point of verifying against real LeetCode history instead of trusting a
  // self-reported click: a submission made BEFORE this contest started must not count,
  // even with an exact slug match -- otherwise solving it last week would trivially
  // "verify" it in a contest started today.
  it('does not count a matching submission timestamped before the contest started', async () => {
    const { user, token, contestId, contest } = await setupStartedContest('stale@example.com');
    await prisma.user.update({ where: { id: user.id }, data: { leetcodeUsername: 'someuser' } });

    const slug = contest.problems[0].slug;
    const beforeStartTimestamp = Math.floor((contest.startTime.getTime() - 60 * 1000) / 1000);
    fetchRecentAcSubmissions.mockResolvedValueOnce([
      { titleSlug: slug, timestamp: String(beforeStartTimestamp) }
    ]);

    const res = await authed(token)(request(app).post(`/contest/${contestId}/verify-leetcode`)).send({ problemIndex: 0 });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
  });
});

describe('hand-picked custom contests', () => {
  it('rejects hand-picking more problems than the total problem count', async () => {
    await createVerifiedUser('overpick@example.com');
    const token = await loginAndGetToken('overpick@example.com');
    const problems = await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const res = await authed(token)(request(app).post('/create-contest')).send({
      numProblems: 3,
      difficulty: 'Easy',
      selectedTopics: [],
      handPickedProblemIds: problems.slice(0, 4).map((p) => p.id)
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a hand-picked id that does not exist', async () => {
    await createVerifiedUser('badid@example.com');
    const token = await loginAndGetToken('badid@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const res = await authed(token)(request(app).post('/create-contest')).send({
      numProblems: 3,
      difficulty: 'Easy',
      selectedTopics: [],
      handPickedProblemIds: ['this-problem-id-does-not-exist']
    });
    expect(res.status).toBe(400);
  });

  it('includes the hand-picked problem exactly once and fills the rest via auto-select, with no duplicates', async () => {
    await createVerifiedUser('handpick@example.com');
    const token = await loginAndGetToken('handpick@example.com');
    const problems = await seedProblems(prisma, 6, { difficulty: 'Easy' });
    const handPicked = problems[0];

    const { body: { contestId } } = await authed(token)(request(app).post('/create-contest')).send({
      numProblems: 3,
      difficulty: 'Easy',
      selectedTopics: [],
      handPickedProblemIds: [handPicked.id]
    });

    const startRes = await authed(token)(request(app).post(`/contest/${contestId}/start`)).send({});
    expect(startRes.status).toBe(200);

    const finalProblems = startRes.body.contest.problems;
    expect(finalProblems).toHaveLength(3);
    // Hand-picked problem placed first, matching startContest's [...handPicked, ...autoFilled] order.
    expect(finalProblems[0].slug).toBe(handPicked.leetcodeId);

    const slugs = finalProblems.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(3); // no duplicates -- the auto-fill correctly excluded the hand-picked one

    // Stored at creation time, not resolved later -- confirm directly against the DB
    // rather than the API response, since buildContestResponse doesn't expose this
    // internal field to the client.
    const contestRow = await prisma.contest.findUnique({ where: { id: contestId } });
    expect(contestRow.handPickedProblemIds).toEqual([handPicked.id]);
  });

  it('creates a contest that is entirely hand-picked, with no auto-fill call needed', async () => {
    await createVerifiedUser('fullhandpick@example.com');
    const token = await loginAndGetToken('fullhandpick@example.com');
    const problems = await seedProblems(prisma, 3, { difficulty: 'Easy' });

    const { body: { contestId } } = await authed(token)(request(app).post('/create-contest')).send({
      numProblems: 3,
      difficulty: 'Easy',
      selectedTopics: [],
      handPickedProblemIds: problems.map((p) => p.id)
    });

    const startRes = await authed(token)(request(app).post(`/contest/${contestId}/start`)).send({});
    expect(startRes.status).toBe(200);
    expect(startRes.body.contest.problems).toHaveLength(3);
    const slugs = startRes.body.contest.problems.map((p) => p.slug).sort();
    expect(slugs).toEqual(problems.map((p) => p.leetcodeId).sort());
  });
});

describe('problem search', () => {
  it('matches by title, case-insensitively, and reports the searching user\'s own solve status', async () => {
    const user = await createVerifiedUser('searcher@example.com');
    const token = await loginAndGetToken('searcher@example.com');
    const problems = await seedProblems(prisma, 3, { difficulty: 'Easy' });
    await prisma.problem.update({ where: { id: problems[0].id }, data: { title: 'Two Sum' } });
    await prisma.problem.update({ where: { id: problems[1].id }, data: { title: 'Three Sum' } });
    await prisma.solvedProblem.create({
      data: { userId: user.id, problemId: problems[0].id, status: 'solved', lastInteractionAt: new Date() }
    });

    const res = await authed(token)(request(app).get('/problems/search?q=sum'));
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(2);

    const twoSum = res.body.rows.find((r) => r.title === 'Two Sum');
    expect(twoSum.yourStatus).toBe('solved');
    const threeSum = res.body.rows.find((r) => r.title === 'Three Sum');
    expect(threeSum.yourStatus).toBeNull();
  });

  it('returns nothing for a query under the 2-character floor, without hitting the DB', async () => {
    await createVerifiedUser('shortquery@example.com');
    const token = await loginAndGetToken('shortquery@example.com');
    await seedProblems(prisma, 3, { difficulty: 'Easy' });

    const res = await authed(token)(request(app).get('/problems/search?q=a'));
    expect(res.status).toBe(200);
    expect(res.body.rows).toEqual([]);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/problems/search?q=array');
    expect(res.status).toBe(401);
  });
});
