import { withPrisma } from '../utils/database.js';
import { bucketByDay, computeStreaks, buildDailyHistory } from '../utils/streakCalculator.js';

const LEETCODE_USERNAME_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;

// 12 weeks -- fits a GitHub-style contribution grid (12 columns x 7 rows) without
// being either a sparse sliver or an overwhelming wall of cells.
const HISTORY_DAYS = 84;

export const updateUser = async (req, res) => {
  try {
    // Always the caller's own verified id -- never trust a client-supplied userId here,
    // or any authenticated user could rename any other user.
    const userId = req.user.userId
    const { name, leetcodeUsername } = req.body || {}

    if (leetcodeUsername !== undefined && leetcodeUsername !== '' && !LEETCODE_USERNAME_REGEX.test(leetcodeUsername)) {
      return res.status(400).json({ error: 'Invalid LeetCode username format' })
    }

    const user = await withPrisma(async (prisma) => {
      try {
        return await prisma.user.update({
          where: { id: userId },
          data: {
            name: name || undefined,
            ...(leetcodeUsername !== undefined ? { leetcodeUsername: leetcodeUsername || null } : {})
          }
        })
      } catch (e) {
        console.error('User update error:', e)
        return null
      }
    })

    res.json({ ok: true, user: user ? { name: user.name, leetcodeUsername: user.leetcodeUsername } : null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed' })
  }
};

// The revision tab's data source -- every problem this user has ever attempted or
// solved, independent of which contest(s) it happened in.
export const getSolvedProblems = async (req, res) => {
  try {
    const userId = req.user.userId
    const result = await withPrisma(async (prisma) => {
      const rows = await prisma.solvedProblem.findMany({
        where: { userId },
        orderBy: { lastInteractionAt: 'desc' },
        include: { problem: { select: { title: true, difficulty: true, leetcodeId: true, leetcodeUrl: true, finalTags: true } } }
      })
      return rows.map((r) => ({
        status: r.status,
        lastInteractionAt: r.lastInteractionAt.getTime(),
        title: r.problem.title,
        difficulty: r.problem.difficulty,
        slug: r.problem.leetcodeId,
        url: r.problem.leetcodeUrl,
        finalTags: r.problem.finalTags
      }))
    })
    res.json({ rows: result })
  } catch (err) {
    console.error('getSolvedProblems error', err)
    res.status(500).json({ error: 'failed' })
  }
};

// Aggregated progress stats for the LeetCode-style solve ring. Deliberately a real
// DB-side aggregation (groupBy), not a raw dump of every SolvedProblem row for the
// client to count itself -- the client receives finished numbers only.
//
// Difficulty keys are derived from what the catalog actually contains rather than a
// hardcoded ['Easy','Medium','Hard'] list: this catalog intentionally never seeded Hard
// problems, so a Hard key simply won't exist in the response and the UI has no empty
// tile to special-case. If Hard problems are ever seeded, it appears on its own.
export const getProblemStats = async (req, res) => {
  try {
    const userId = req.user.userId
    const result = await withPrisma(async (prisma) => {
      const [catalogCounts, solvedRows] = await Promise.all([
        prisma.problem.groupBy({ by: ['difficulty'], _count: { _all: true } }),
        prisma.solvedProblem.findMany({
          where: { userId },
          select: { status: true, problem: { select: { difficulty: true } } }
        })
      ])

      const byDifficulty = {}
      for (const row of catalogCounts) {
        byDifficulty[row.difficulty] = { solved: 0, total: row._count._all }
      }

      let solved = 0
      let attempting = 0
      for (const row of solvedRows) {
        if (row.status === 'solved') {
          solved++
          const bucket = byDifficulty[row.problem.difficulty]
          if (bucket) bucket.solved++
        } else {
          attempting++
        }
      }

      const totalCatalog = catalogCounts.reduce((sum, row) => sum + row._count._all, 0)
      return { solved, attempting, totalCatalog, byDifficulty }
    })

    res.json(result)
  } catch (err) {
    console.error('getProblemStats error', err)
    res.status(500).json({ error: 'failed' })
  }
};

// Solve streak, per-topic strength, and a daily activity history for the revision
// tab's analytics section -- all three derived from the same SolvedProblem rows
// already backing getSolvedProblems/getProblemStats, no new tracking table needed.
export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId
    const result = await withPrisma(async (prisma) => {
      const [solvedRows, catalogTagRows] = await Promise.all([
        prisma.solvedProblem.findMany({
          where: { userId, status: 'solved' },
          select: { lastInteractionAt: true, problem: { select: { finalTags: true } } }
        }),
        prisma.problem.findMany({ select: { finalTags: true } })
      ])

      const dayCounts = bucketByDay(solvedRows.map((r) => r.lastInteractionAt))
      const streak = computeStreaks(dayCounts)
      const history = buildDailyHistory(dayCounts, HISTORY_DAYS)

      // Array tag columns need an in-memory tally -- Prisma has no group-by-array-
      // element aggregate, and the catalog (~2,458 rows) is nowhere near enough to
      // need one, same reasoning as the plain-substring problem search.
      const totalByTag = new Map()
      for (const row of catalogTagRows) {
        for (const tag of row.finalTags) totalByTag.set(tag, (totalByTag.get(tag) || 0) + 1)
      }
      const solvedByTag = new Map()
      for (const row of solvedRows) {
        for (const tag of row.problem.finalTags) solvedByTag.set(tag, (solvedByTag.get(tag) || 0) + 1)
      }
      const topicStrength = Array.from(totalByTag.entries())
        .map(([tag, total]) => ({ tag, solved: solvedByTag.get(tag) || 0, total }))
        .sort((a, b) => b.solved - a.solved || b.total - a.total)

      return { streak, topicStrength, history }
    })

    res.json(result)
  } catch (err) {
    console.error('getAnalytics error', err)
    res.status(500).json({ error: 'failed' })
  }
};

// Powers hand-picking specific problems into a custom contest (createContest's
// handPickedProblemIds). Plain case-insensitive substring match on title -- the
// catalog is only ~2,458 rows, nowhere near enough to need pg_trgm/full-text search
// infrastructure for what's really a small personal-scale lookup. yourStatus is scoped
// to the searching user's own solve history only, not any contest's roster -- hand-
// picking happens during contest creation, before the contest (and so its roster)
// exists, so a roster-based signal genuinely isn't available yet at this point.
export const searchProblems = async (req, res) => {
  try {
    const userId = req.user.userId
    const q = (req.query.q || '').trim()
    if (q.length < 2) return res.json({ rows: [] })

    const result = await withPrisma(async (prisma) => {
      const problems = await prisma.problem.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        select: { id: true, title: true, difficulty: true, finalTags: true, judgeSupported: true, leetcodeUrl: true },
        take: 20,
        orderBy: { title: 'asc' }
      })

      const statusRows = await prisma.solvedProblem.findMany({
        where: { userId, problemId: { in: problems.map((p) => p.id) } },
        select: { problemId: true, status: true }
      })
      const statusByProblemId = new Map(statusRows.map((r) => [r.problemId, r.status]))

      return problems.map((p) => ({
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        finalTags: p.finalTags,
        judgeSupported: p.judgeSupported,
        url: p.leetcodeUrl,
        yourStatus: statusByProblemId.get(p.id) || null
      }))
    })

    res.json({ rows: result })
  } catch (err) {
    console.error('searchProblems error', err)
    res.status(500).json({ error: 'failed' })
  }
};

// Scoped to the caller's own userId only -- never accepts a target user, so there's no
// way to wipe anyone else's history.
export const clearSolvedProblems = async (req, res) => {
  try {
    const userId = req.user.userId
    const result = await withPrisma((prisma) => prisma.solvedProblem.deleteMany({ where: { userId } }))
    res.json({ ok: true, deleted: result.count })
  } catch (err) {
    console.error('clearSolvedProblems error', err)
    res.status(500).json({ error: 'failed' })
  }
};

export const getDebugResults = async (req, res) => {
  // Debug-only endpoint: never available in production, no env-var override.
  // A stray DEBUG_RESULTS=true in a prod environment would otherwise reopen this.
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'not found' })
  }
  try {
    const result = await withPrisma(async (prisma) => {
      const rows = await prisma.result.findMany({ orderBy: { id: 'desc' }, take: 100 })
      return { ok: true, rows }
    })
    res.json(result)
  } catch (err) {
    console.error('debug results error', err)
    res.status(500).json({ error: 'failed' })
  }
};