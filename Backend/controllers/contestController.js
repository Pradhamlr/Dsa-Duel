import { randomUUID } from 'crypto';
import { withPrisma } from '../utils/database.js';
import { ensureProblemsAvailable } from '../utils/problemIngestion.js';
import { fetchRecentAcSubmissions } from '../utils/leetcode.js';
import { registerClient, unregisterClient, broadcastContestUpdate } from '../services/contestEvents.js';

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

export const buildContestResponse = async (prisma, contest) => {
  const rows = await prisma.result.findMany({ where: { contestId: contest.id } });
  const results = {};
  const userIds = new Set();
  for (const r of rows) {
    userIds.add(r.userId);
    results[r.userId] = results[r.userId] || { solved: {} };
    if (r.solvedAt) results[r.userId].solved[r.problemIndex] = true;
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

  return {
    id: contest.id,
    problems: contest.problems,
    createdAt: contest.createdAt ? contest.createdAt.getTime() : Date.now(),
    startTime: contest.startTime ? contest.startTime.getTime() : null,
    duration: contest.durationSeconds,
    results
  };
};

export const createContest = async (req, res) => {
  try {
    const { numProblems, difficulty, duration, selectedTopics } = req.validatedBody;
    const problemCount = numProblems;

    const filters = { difficulty, selectedTopics };

    // Ensure we have enough problems in database
    try {
      await ensureProblemsAvailable(filters, problemCount);
    } catch (error) {
      console.error('Problem ingestion failed:', error);
      return res.status(500).json({ error: 'Failed to fetch problems from database' });
    }

    const result = await withPrisma(async (prisma) => {
      // Query Problem table for matching problems
      const where = {};
      
      if (difficulty !== 'Mixed') {
        where.difficulty = difficulty;
      }
      
      if (selectedTopics.length > 0) {
        where.finalTags = {
          hasSome: selectedTopics
        };
      }

      console.log('Querying problems with filters:', { difficulty, selectedTopics, where });
      const problems = await prisma.problem.findMany({ where });
      console.log(`Found ${problems.length} problems in database`);

      if (problems.length < problemCount) {
        console.error(`Not enough problems: found ${problems.length}, need ${problemCount}`);
        return { error: 'Not enough problems available after ingestion', status: 500 };
      }

      // Randomly shuffle and select required count
      const shuffled = problems.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, problemCount);
      console.log('Selected problems:', selected.map(p => p.title));

      // Convert to contest format. testCases is deliberately excluded here -- it's the
      // judge's answer key, and this snapshot is shipped straight to the client, so it
      // must stay server-side only (fetched fresh at submit-time in Phase 4).
      const chosen = selected.map(p => ({
        title: p.title,
        slug: p.leetcodeId,
        difficulty: p.difficulty,
        url: p.leetcodeUrl,
        finalTags: p.finalTags,
        judgeSupported: p.judgeSupported,
        ...(p.judgeSupported ? { codeSnippets: p.codeSnippets } : {})
      }));

      const id = randomUUID().slice(0, 8);
      const durationSeconds = duration !== undefined ? duration : 90 * 60;

      const creatorId = req.user.userId;
      const creatorName = req.user.username || req.user.email?.split('@')[0];
      
      try {
        await prisma.user.upsert({ 
          where: { id: creatorId }, 
          update: { name: creatorName || undefined }, 
          create: { id: creatorId, name: creatorName || undefined } 
        });
      } catch (e) {
        console.error('User upsert error:', e);
      }

      const created = await prisma.contest.create({
        data: {
          id,
          numProblems: problemCount,
          difficulty,
          problems: chosen,
          durationSeconds,
          creatorId
        }
      });
      
      return { contestId: created.id, problems: chosen };
    });

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

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
        results[r.userId] = results[r.userId] || { solved: {} }
        if (r.solvedAt) results[r.userId].solved[r.problemIndex] = true
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
        problems: c.problems,
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

      const update = { startTime: new Date() }
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