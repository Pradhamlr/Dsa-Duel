import { randomUUID } from 'crypto';
import { withPrisma } from '../utils/database.js';
import { ensureProblemsAvailable } from '../utils/problemIngestion.js';
import { fetchRecentAcSubmissions } from '../utils/leetcode.js';
import { registerClient, unregisterClient, broadcastContestUpdate, getRosterUserIds } from '../services/contestEvents.js';
import { selectWithTieredFallback, fetchHandPickedProblems } from '../utils/contestProblemSelection.js';

const upsertUserDisplayName = async (prisma, userId, displayName) => {
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: { name: displayName || undefined },
      create: { id: userId, name: displayName || undefined }
    });
  } catch (e) {
    console.error('User upsert error:', e);
  }
};

// Tracks a user's relationship to a problem independent of any single contest --
// powers the revision tab and (Phase 4) biasing future contest problem selection away
// from what a user has already engaged with. Deliberately never downgrades an
// already-'solved' row back to 'attempted' on a later failed submission of the same
// problem (e.g. a different contest reusing it, or a deliberately-wrong test submit).
export const recordProblemInteraction = async (prisma, { userId, slug, status }) => {
  if (!slug) return;
  const problem = await prisma.problem.findUnique({ where: { leetcodeId: slug }, select: { id: true } });
  if (!problem) return;

  const existing = await prisma.solvedProblem.findUnique({
    where: { userId_problemId: { userId, problemId: problem.id } }
  });
  if (existing?.status === 'solved' && status === 'attempted') return;

  await prisma.solvedProblem.upsert({
    where: { userId_problemId: { userId, problemId: problem.id } },
    update: { status, lastInteractionAt: new Date() },
    create: { userId, problemId: problem.id, status, lastInteractionAt: new Date() }
  });
};

export const markResultSolved = async (prisma, { contestId, userId, problemIndex, verifiedVia, slug }) => {
  await prisma.result.upsert({
    where: {
      contestId_userId_problemIndex: { contestId, userId, problemIndex }
    },
    update: { solvedAt: new Date(), verifiedVia },
    create: { contestId, userId, problemIndex, solvedAt: new Date(), verifiedVia }
  });

  await recordProblemInteraction(prisma, { userId, slug, status: 'solved' });
};

// Partial credit from a judge Submit that didn't fully pass. Only ever called for
// 'judge' -- manual mark and LeetCode verify have no test-case concept, they're
// binary via markResultSolved above. Best-ever: a later, worse resubmission never
// overwrites a better score already on file, same philosophy as
// recordProblemInteraction's existing "never downgrade solved back to attempted"
// rule, extended to a numeric score. A prior full solve (solvedAt set) always wins
// outright and is left untouched here.
export const upsertPartialResult = async (prisma, { contestId, userId, problemIndex, testCasesPassed, testCasesTotal }) => {
  const existing = await prisma.result.findUnique({
    where: { contestId_userId_problemIndex: { contestId, userId, problemIndex } }
  });

  if (existing?.solvedAt) return;
  if (existing && existing.testCasesPassed != null && existing.testCasesPassed >= testCasesPassed) return;

  await prisma.result.upsert({
    where: { contestId_userId_problemIndex: { contestId, userId, problemIndex } },
    update: { testCasesPassed, testCasesTotal, verifiedVia: 'judge' },
    create: { contestId, userId, problemIndex, testCasesPassed, testCasesTotal, verifiedVia: 'judge' }
  });
};

export const buildContestResponse = async (prisma, contest) => {
  const rows = await prisma.result.findMany({ where: { contestId: contest.id } });
  const results = {};
  const userIds = new Set();
  for (const r of rows) {
    userIds.add(r.userId);
    results[r.userId] = results[r.userId] || { solved: {}, solvedAt: {}, score: {}, testCasesPassed: {}, testCasesTotal: {} };
    if (r.solvedAt) {
      results[r.userId].solved[r.problemIndex] = true;
      results[r.userId].solvedAt[r.problemIndex] = r.solvedAt.getTime();
      results[r.userId].score[r.problemIndex] = 1;
    } else if (r.testCasesPassed != null && r.testCasesTotal) {
      results[r.userId].score[r.problemIndex] = r.testCasesPassed / r.testCasesTotal;
      results[r.userId].testCasesPassed[r.problemIndex] = r.testCasesPassed;
      results[r.userId].testCasesTotal[r.problemIndex] = r.testCasesTotal;
    }
  }

  // Without this, every live SSE-pushed update showed raw userIds in Live Standings
  // (only the initial GET /contest/:id load enriched names) -- names would only
  // "appear" once something happened to trigger that separate endpoint, which read as
  // solved-count rows randomly switching from an ID to a name mid-contest.
  if (userIds.size > 0) {
    const users = await prisma.user.findMany({ where: { id: { in: Array.from(userIds) } } });
    const nameMap = users.reduce((acc, u) => { acc[u.id] = u.name || null; return acc; }, {});
    for (const uid of Object.keys(results)) {
      results[uid].name = nameMap[uid] || null;
    }
  }

  // creatorId/creatorName were missing here (only the one-time GET /contest/:id load
  // included them) -- so the moment any live SSE 'contest' event arrived, it silently
  // wiped creatorId from client state, making the "only creator can start" check
  // (falsy once creatorId is undefined) show the Start Contest button to everyone, not
  // just the creator. The server-side check was never affected (it reads the DB row
  // directly), but the client display was wrong. Fixed by including it here too, same
  // as getContest already does.
  let creatorName = null;
  if (contest.creatorId) {
    const creator = await prisma.user.findUnique({ where: { id: contest.creatorId } });
    creatorName = creator ? creator.name : null;
  }

  return {
    id: contest.id,
    problems: contest.problems || [],
    createdAt: contest.createdAt ? contest.createdAt.getTime() : Date.now(),
    startTime: contest.startTime ? contest.startTime.getTime() : null,
    duration: contest.durationSeconds,
    results,
    creatorId: contest.creatorId || null,
    creatorName
  };
};

export const createContest = async (req, res) => {
  try {
    const { numProblems, difficulty, duration, selectedTopics, pool, handPickedProblemIds } = req.validatedBody;
    // Hand-picked problems bypass difficulty/topic/pool entirely -- same mental model
    // as the NeetCode pool filter, which only ever governs the auto-selected portion.
    // The fast-fail guard below only needs to cover the remaining auto-fill slots.
    const remainingSlots = numProblems - handPickedProblemIds.length;

    const filters = { difficulty, selectedTopics, pool };

    // Fast-fail guard: confirms these settings CAN be satisfied at all (ignoring any
    // roster-based exclusion applied later at Start, which only ever narrows further)
    // before creating a contest whose filters can never produce enough problems.
    try {
      await ensureProblemsAvailable(filters, remainingSlots);
    } catch (error) {
      console.error('Problem ingestion failed:', error);
      return res.status(500).json({ error: 'Failed to fetch problems from database' });
    }

    const result = await withPrisma(async (prisma) => {
      // These ids came from this app's own search endpoint, so they should already be
      // real -- this is a defensive check against a stale/tampered request, not the
      // primary validation path. Failing clearly here beats silently dropping a bad id
      // and shipping a contest with fewer hand-picked problems than the creator saw.
      if (handPickedProblemIds.length > 0) {
        const foundCount = await prisma.problem.count({ where: { id: { in: handPickedProblemIds } } });
        if (foundCount !== handPickedProblemIds.length) {
          return { error: 'One or more hand-picked problems could not be found', status: 400 };
        }
      }

      const id = randomUUID().slice(0, 8);
      const durationSeconds = duration !== undefined ? duration : 90 * 60;

      const creatorId = req.user.userId;
      const creatorName = req.user.username || req.user.email?.split('@')[0];
      await upsertUserDisplayName(prisma, creatorId, creatorName);

      // Problems aren't chosen here -- Phase 4b defers selection to startContest, which
      // can exclude what anyone currently connected in the SSE roster has recently
      // solved/attempted. See utils/contestProblemSelection.js. Hand-picked ids are the
      // one exception: those are locked in now, not resolved at Start.
      const created = await prisma.contest.create({
        data: {
          id,
          numProblems,
          difficulty,
          selectedTopics,
          pool,
          handPickedProblemIds,
          durationSeconds,
          creatorId
        }
      });

      return { contestId: created.id };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create' });
  }
};

export const getContest = async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const id = req.params.id
      const c = await prisma.contest.findUnique({ where: { id } })
      if (!c) return null

      const rows = await prisma.result.findMany({ where: { contestId: id } })
      const results = {}
      const userIds = new Set()
      for (const r of rows) {
        userIds.add(r.userId)
        results[r.userId] = results[r.userId] || { solved: {}, solvedAt: {}, score: {}, testCasesPassed: {}, testCasesTotal: {} }
        if (r.solvedAt) {
          results[r.userId].solved[r.problemIndex] = true
          results[r.userId].solvedAt[r.problemIndex] = r.solvedAt.getTime()
          results[r.userId].score[r.problemIndex] = 1
        } else if (r.testCasesPassed != null && r.testCasesTotal) {
          results[r.userId].score[r.problemIndex] = r.testCasesPassed / r.testCasesTotal
          results[r.userId].testCasesPassed[r.problemIndex] = r.testCasesPassed
          results[r.userId].testCasesTotal[r.problemIndex] = r.testCasesTotal
        }
      }

      let nameMap = {}
      if (userIds.size > 0) {
        const users = await prisma.user.findMany({ where: { id: { in: Array.from(userIds) } } })
        nameMap = users.reduce((acc, u) => { acc[u.id] = u.name || null; return acc }, {})
        for (const uid of Object.keys(results)) {
          results[uid].name = nameMap[uid] || null
        }
      }

      let creatorName = null
      if (c.creatorId) {
        const user = await prisma.user.findUnique({ where: { id: c.creatorId } })
        creatorName = user ? user.name : null
      }

      return {
        id: c.id,
        problems: c.problems || [],
        createdAt: c.createdAt ? c.createdAt.getTime() : Date.now(),
        startTime: c.startTime ? c.startTime.getTime() : null,
        duration: c.durationSeconds,
        results,
        creatorId: c.creatorId || null,
        creatorName
      }
    })
    
    if (!result) return res.status(404).json({ error: 'not found' })
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed' })
  }
};

export const startContest = async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const id = req.params.id
      const contest = await prisma.contest.findUnique({ where: { id } })
      if (!contest) return { error: 'not found', status: 404 }
      if (contest.startTime) return { error: 'already started', status: 400 }

      const { duration } = req.validatedBody

      if (contest.creatorId && contest.creatorId !== req.user.userId) {
        return { error: 'only creator can start', status: 403 }
      }

      // Hand-picked problems were locked in at creation time -- fetched here in the
      // creator's own pick order, never re-resolved or filtered by roster history.
      const handPicked = await fetchHandPickedProblems(prisma, contest.handPickedProblemIds)
      const remainingSlots = contest.numProblems - handPicked.length

      // Deferred problem selection (Phase 4b): pick the REMAINING problems now, not at
      // create time, so we can try to avoid handing anyone currently in the room a
      // problem they've recently solved/attempted. getRosterUserIds reads the same
      // in-memory SSE connection registry the live "Participants" panel is built from.
      // baseExcludeIds keeps the auto-fill from ever re-picking a hand-picked problem.
      let autoFilled = []
      if (remainingSlots > 0) {
        const rosterUserIds = getRosterUserIds(id)
        autoFilled = await selectWithTieredFallback(prisma, {
          difficulty: contest.difficulty,
          selectedTopics: contest.selectedTopics,
          pool: contest.pool,
          problemCount: remainingSlots,
          rosterUserIds,
          baseExcludeIds: contest.handPickedProblemIds
        })

        if (!autoFilled) {
          return { error: 'Not enough problems available to start this contest', status: 500 }
        }
      }

      const chosen = [...handPicked, ...autoFilled]
      const update = { startTime: new Date(), problems: chosen }
      if (duration !== undefined) update.durationSeconds = duration

      const updated = await prisma.contest.update({ where: { id }, data: update })
      return {
        startedAt: updated.startTime ? updated.startTime.getTime() : Date.now(),
        duration: updated.durationSeconds,
        contest: await buildContestResponse(prisma, updated)
      }
    })

    if (result.error) return res.status(result.status).json({ error: result.error })
    broadcastContestUpdate(req.params.id, result.contest)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to start' })
  }
};

export const getContestStatus = async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const id = req.params.id
      const c = await prisma.contest.findUnique({ where: { id } })
      if (!c) return null
      return { startTime: c.startTime ? c.startTime.getTime() : null, duration: c.durationSeconds }
    })
    
    if (!result) return res.status(404).json({ error: 'not found' })
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed' })
  }
};

export const markProblem = async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const id = req.params.id
      const { problemIndex, solved } = req.validatedBody
      const userId = req.user.userId
      const displayName = req.user.username || req.user.email?.split('@')[0]

      const contest = await prisma.contest.findUnique({ where: { id } })
      if (!contest) return { error: 'not found', status: 404 }
      if (!contest.startTime) return { error: 'contest not started', status: 400 }

      const problemSnapshot = contest.problems[problemIndex]
      if (!problemSnapshot) return { error: 'invalid problem index', status: 400 }

      if (solved) {
        await upsertUserDisplayName(prisma, userId, displayName)
        await markResultSolved(prisma, { contestId: id, userId, problemIndex, verifiedVia: 'manual', slug: problemSnapshot.slug })
      } else {
        await prisma.result.deleteMany({ where: { contestId: id, userId, problemIndex } })
      }

      return { ok: true, contest: await buildContestResponse(prisma, contest) }
    })

    if (result.error) return res.status(result.status).json({ error: result.error })
    broadcastContestUpdate(req.params.id, result.contest)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to mark' })
  }
};

// Live contest updates over Server-Sent Events: pushes the full contest payload
// whenever it changes (mark/verify/judge-accept/start) and a "who's currently watching"
// roster derived purely from which SSE connections are open -- no separate join
// endpoint needed, the connection itself IS the presence signal.
export const contestEvents = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const displayName = req.user.username || req.user.email?.split('@')[0] || null;

  const result = await withPrisma(async (prisma) => {
    const contest = await prisma.contest.findUnique({ where: { id } });
    if (!contest) return null;
    return buildContestResponse(prisma, contest);
  });

  if (!result) return res.status(404).json({ error: 'not found' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  const client = registerClient(id, userId, displayName, res);
  res.write(`event: contest\ndata: ${JSON.stringify(result)}\n\n`);

  // Keeps intermediary proxies (and Render's own) from closing an idle-looking
  // connection; ":"-prefixed lines are SSE comments, ignored by EventSource.
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unregisterClient(id, client);
  });
};

// Full problem details for the LeetCode-style contest view: description HTML and
// example test cases, on top of what's already in the contest.problems snapshot.
// Not auth-gated, matching getContest/getContestStatus -- this is public LeetCode
// data (problem statement + its own worked examples), same trust level as the title
// and URL the client already has.
export const getProblemDetails = async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const id = req.params.id
      const index = Number(req.params.index)

      const contest = await prisma.contest.findUnique({ where: { id } })
      if (!contest) return { error: 'not found', status: 404 }
      if (!contest.startTime) return { error: 'contest not started', status: 400 }

      const snapshot = contest.problems[index]
      if (!snapshot) return { error: 'invalid problem index', status: 400 }

      const problem = await prisma.problem.findUnique({ where: { leetcodeId: snapshot.slug } })
      if (!problem) return { error: 'problem not found', status: 404 }

      return {
        title: problem.title,
        difficulty: problem.difficulty,
        slug: problem.leetcodeId,
        url: problem.leetcodeUrl,
        finalTags: problem.finalTags,
        description: problem.description || null,
        judgeSupported: problem.judgeSupported,
        testCases: problem.judgeSupported ? problem.testCases : null
      }
    })

    if (result.error) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to load problem details' })
  }
};

// Verifies a solve against the user's real LeetCode submission history instead of
// trusting a self-reported click. Needs User.leetcodeUsername set, and the check is
// scoped to submissions timestamped after the contest started (so a problem solved
// long before this contest doesn't count).
export const verifyLeetCodeSubmission = async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const id = req.params.id
      const { problemIndex } = req.validatedBody
      const userId = req.user.userId

      const contest = await prisma.contest.findUnique({ where: { id } })
      if (!contest) return { error: 'not found', status: 404 }
      if (!contest.startTime) return { error: 'contest not started', status: 400 }

      const problem = contest.problems[problemIndex]
      if (!problem) return { error: 'invalid problem index', status: 400 }

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user?.leetcodeUsername) {
        return {
          error: 'Set your LeetCode username in your profile first',
          status: 400,
          code: 'LEETCODE_USERNAME_NOT_SET'
        }
      }

      const submissions = await fetchRecentAcSubmissions(user.leetcodeUsername, 30)
      const contestStartMs = contest.startTime.getTime()

      const match = submissions.find((s) => (
        s.titleSlug === problem.slug && Number(s.timestamp) * 1000 >= contestStartMs
      ))

      if (!match) {
        return {
          verified: false,
          message: 'No matching accepted LeetCode submission found yet. Make sure your LeetCode submission history is public, solve the problem there, then try again.'
        }
      }

      await markResultSolved(prisma, { contestId: id, userId, problemIndex, verifiedVia: 'leetcode', slug: problem.slug })

      return { verified: true, contest: await buildContestResponse(prisma, contest) }
    })

    if (result.error) return res.status(result.status).json({ error: result.error, code: result.code })
    if (result.verified) broadcastContestUpdate(req.params.id, result.contest)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to verify' })
  }
};