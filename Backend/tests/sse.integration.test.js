import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import http from 'http';
import request from 'supertest';
import bcrypt from 'bcrypt';

const { default: app } = await import('../app.js');
const { prisma, resetDb, seedProblems } = await import('./dbHelpers.js');
const { redis, ensureRedisConnected } = await import('../utils/redisClient.js');
const { assertSafeTestRedis } = await import('../utils/dbSafety.js');

const PASSWORD = 'TestPass123!';

async function createVerifiedUser(email) {
  return prisma.user.create({
    data: { id: randomUUID(), email, password: await bcrypt.hash(PASSWORD, 10), name: email.split('@')[0], emailVerified: true }
  });
}

async function loginAndGetToken(email) {
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}

// supertest can't hold a streaming connection open while the test also fires other
// concurrent requests at the same app -- needs a real listening server instead. Raw
// http.get + hand-parsing the "event: x\ndata: y\n\n" frame format rather than adding
// a new SSE-client dependency for a format this simple.
function connectSSE(port, path) {
  return new Promise((resolve, reject) => {
    const events = [];
    let readIndex = 0; // events[0..readIndex) have already been claimed by a waitForEvent call
    const waiters = [];

    // Satisfies waiters from already-buffered-but-unclaimed events first, in event
    // order -- without this, a waitForEvent registered just AFTER an event already
    // arrived (a real race: several frames can arrive before the caller gets a chance
    // to call waitForEvent at all, e.g. the roster broadcast a fresh connection
    // triggers on itself) would silently miss it and time out for no real reason.
    function tryDeliver() {
      for (let w = 0; w < waiters.length; w++) {
        for (let i = readIndex; i < events.length; i++) {
          if (events[i].event === waiters[w].eventName) {
            readIndex = i + 1;
            const waiter = waiters.splice(w, 1)[0];
            clearTimeout(waiter.timer);
            waiter.resolve(events[i]);
            return tryDeliver();
          }
        }
      }
    }

    const req = http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      if (res.statusCode !== 200) {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch { /* non-JSON error body */ }
          resolve({ statusCode: res.statusCode, body: parsed, events, close: () => req.destroy() });
        });
        return;
      }

      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (frame.startsWith(':')) continue; // heartbeat comment, not a real event
          const eventMatch = frame.match(/^event: (.+)$/m);
          const dataMatch = frame.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          events.push({ event: eventMatch[1], data: JSON.parse(dataMatch[1]) });
        }
        tryDeliver();
      });

      resolve({
        statusCode: res.statusCode,
        events,
        close: () => req.destroy(),
        // Claims the next unclaimed occurrence of eventName, checking the buffer
        // first (see tryDeliver) before falling back to waiting for a future push.
        waitForEvent: (eventName, timeoutMs = 3000) => new Promise((res2, rej2) => {
          const timer = setTimeout(() => rej2(new Error(`timeout waiting for event "${eventName}"`)), timeoutMs);
          waiters.push({ eventName, resolve: res2, timer });
          tryDeliver();
        })
      });
    });

    req.on('error', reject);
  });
}

let server;
let port;

beforeEach(async () => {
  await resetDb();
  assertSafeTestRedis();
  await ensureRedisConnected();
  await redis.flushdb();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  port = server.address().port;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

describe('SSE contest events', () => {
  it('rejects a connection with no token, without opening a stream', async () => {
    const conn = await connectSSE(port, '/contest/some-id/events');
    expect(conn.statusCode).toBe(401);
    expect(conn.body.code).toBe('ACCESS_TOKEN_REQUIRED');
  });

  it('returns 404 for a nonexistent contest without opening a stream', async () => {
    await createVerifiedUser('sse404@example.com');
    const token = await loginAndGetToken('sse404@example.com');
    const conn = await connectSSE(port, `/contest/does-not-exist/events?token=${token}`);
    expect(conn.statusCode).toBe(404);
  });

  it('sends a roster snapshot and the current contest state right after connecting', async () => {
    const user = await createVerifiedUser('sseinit@example.com');
    const token = await loginAndGetToken('sseinit@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const { body: { contestId } } = await request(app)
      .post('/create-contest')
      .set('Authorization', `Bearer ${token}`)
      .send({ numProblems: 3, difficulty: 'Easy', selectedTopics: [] });
    await request(app).post(`/contest/${contestId}/start`).set('Authorization', `Bearer ${token}`).send({});

    const conn = await connectSSE(port, `/contest/${contestId}/events?token=${token}`);

    // registerClient's own broadcastRoster runs before the handler's explicit
    // "contest" write, so a fresh connection actually sees roster arrive first --
    // real, correct behavior, not something either side needs to be reordered for.
    const roster = await conn.waitForEvent('roster');
    expect(roster.data).toEqual([{ userId: user.id, name: expect.any(String) }]);

    const initial = await conn.waitForEvent('contest');
    expect(initial.data.id).toBe(contestId);

    conn.close();
  });

  it('broadcasts a roster update to an existing connection when a second user joins', async () => {
    const userA = await createVerifiedUser('rosterA@example.com');
    await createVerifiedUser('rosterB@example.com');
    const tokenA = await loginAndGetToken('rosterA@example.com');
    const tokenB = await loginAndGetToken('rosterB@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const { body: { contestId } } = await request(app)
      .post('/create-contest')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ numProblems: 3, difficulty: 'Easy', selectedTopics: [] });
    await request(app).post(`/contest/${contestId}/start`).set('Authorization', `Bearer ${tokenA}`).send({});

    const connA = await connectSSE(port, `/contest/${contestId}/events?token=${tokenA}`);
    await connA.waitForEvent('roster'); // A's own join broadcasts a 1-person roster to itself first
    const connB = await connectSSE(port, `/contest/${contestId}/events?token=${tokenB}`);

    const roster = await connA.waitForEvent('roster'); // the real one, triggered by B joining
    expect(roster.data).toHaveLength(2);
    expect(roster.data.map((r) => r.userId).sort()).toEqual([userA.id, (await prisma.user.findUnique({ where: { email: 'rosterB@example.com' } })).id].sort());

    connA.close();
    connB.close();
  });

  it('broadcasts a contest update to an open connection when a problem is marked solved', async () => {
    const user = await createVerifiedUser('ssemark@example.com');
    const token = await loginAndGetToken('ssemark@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const { body: { contestId } } = await request(app)
      .post('/create-contest')
      .set('Authorization', `Bearer ${token}`)
      .send({ numProblems: 3, difficulty: 'Easy', selectedTopics: [] });
    await request(app).post(`/contest/${contestId}/start`).set('Authorization', `Bearer ${token}`).send({});

    const conn = await connectSSE(port, `/contest/${contestId}/events?token=${token}`);
    await conn.waitForEvent('roster'); // drain the connection's own initial frames first --
    await conn.waitForEvent('contest'); // otherwise this pre-mark snapshot satisfies the waiter below

    const updatePromise = conn.waitForEvent('contest');

    await request(app)
      .post(`/contest/${contestId}/mark`)
      .set('Authorization', `Bearer ${token}`)
      .send({ problemIndex: 0, solved: true });

    const update = await updatePromise;
    expect(update.data.results[user.id].solved[0]).toBe(true);

    conn.close();
  });

  it('broadcasts a roster update to the remaining connection when the other one closes', async () => {
    await createVerifiedUser('closeA@example.com');
    await createVerifiedUser('closeB@example.com');
    const tokenA = await loginAndGetToken('closeA@example.com');
    const tokenB = await loginAndGetToken('closeB@example.com');
    await seedProblems(prisma, 5, { difficulty: 'Easy' });

    const { body: { contestId } } = await request(app)
      .post('/create-contest')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ numProblems: 3, difficulty: 'Easy', selectedTopics: [] });
    await request(app).post(`/contest/${contestId}/start`).set('Authorization', `Bearer ${tokenA}`).send({});

    const connA = await connectSSE(port, `/contest/${contestId}/events?token=${tokenA}`);
    await connA.waitForEvent('roster'); // A's own join broadcasts a 1-person roster first
    const connB = await connectSSE(port, `/contest/${contestId}/events?token=${tokenB}`);
    await connA.waitForEvent('roster'); // the 2-person roster from B joining

    const shrinkPromise = connA.waitForEvent('roster');
    connB.close();
    // unregisterClient fires on the server's 'close' listener for B's request, which
    // is async relative to us calling .destroy() here -- waitForEvent's own timeout
    // covers the wait.
    const shrunk = await shrinkPromise;
    expect(shrunk.data).toHaveLength(1);

    connA.close();
  });
});
