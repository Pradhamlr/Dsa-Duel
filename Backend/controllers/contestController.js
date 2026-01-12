import { randomUUID } from 'crypto';
import { withPrisma } from '../utils/database.js';
import { fetchLeetCodePool, getProblemType } from '../utils/leetcode.js';
import { classifyProblems } from '../utils/problemClassifier.js';
import { isBadTagSet } from '../utils/tagQuality.js';

export const createContest = async (req, res) => {
  try {
    const { numProblems = 5, difficulty = 'mixed', duration } = req.body || {};
    const pool = await fetchLeetCodePool();

    let filtered = (difficulty === 'Easy' || difficulty === 'Medium')
      ? pool.filter(p => p.difficulty === difficulty)
      : pool;

    const topic = req.body && req.body.topic ? req.body.topic : null
    if (topic) {
      const byTopic = filtered.filter(p => getProblemType(p) === topic)
      if (byTopic.length < numProblems) {
        return res.status(400).json({ error: 'Not enough problems for selected topic' })
      }
      filtered = byTopic
    }

    if (filtered.length < numProblems) return res.status(500).json({ error: 'Not enough problems' });

    const chosen = [];
    const used = new Set();
    while (chosen.length < numProblems) {
      const idx = Math.floor(Math.random() * filtered.length);
      if (!used.has(idx)) { used.add(idx); chosen.push(filtered[idx]); }
    }

    const result = await withPrisma(async (prisma) => {
      const id = randomUUID().slice(0,8);
      const durationSeconds = duration && Number.isFinite(Number(duration)) ? Number(duration) : 90 * 60

      const creatorId = req.user.userId
      const creatorName = req.user.username || req.user.email?.split('@')[0]
      try {
        await prisma.user.upsert({ where: { id: creatorId }, update: { name: creatorName || undefined }, create: { id: creatorId, name: creatorName || undefined } })
      } catch (e) {
        console.error('User upsert error:', e)
      }

      const created = await prisma.contest.create({
        data: {
          id,
          numProblems: Number(numProblems),
          difficulty,
          problems: chosen,
          durationSeconds,
          creatorId
        }
      })
      
      return { contestId: created.id, problems: chosen }
    })

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

      const { duration } = req.body || {}

      if (contest.creatorId && contest.creatorId !== req.user.userId) {
        return { error: 'only creator can start', status: 403 }
      }

      const update = { startTime: new Date() }
      if (duration && Number.isFinite(duration)) update.durationSeconds = Number(duration)

      const updated = await prisma.contest.update({ where: { id }, data: update })
      return { startedAt: updated.startTime ? updated.startTime.getTime() : Date.now(), duration: updated.durationSeconds }
    })

    if (result.error) return res.status(result.status).json({ error: result.error })
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
      const { problemIndex, solved } = req.body
      const userId = req.user.userId
      const displayName = req.user.username || req.user.email?.split('@')[0]

      const contest = await prisma.contest.findUnique({ where: { id } })
      if (!contest) return { error: 'not found', status: 404 }
      if (!contest.startTime) return { error: 'contest not started', status: 400 }

      if (solved) {
        try {
          await prisma.user.upsert({
            where: { id: userId },
            update: { name: displayName || undefined },
            create: { id: userId, name: displayName || undefined }
          })
        } catch (e) {
          console.error('User upsert error:', e)
        }

        await prisma.result.upsert({
          where: {
            contestId_userId_problemIndex: {
              contestId: id,
              userId,
              problemIndex: Number(problemIndex)
            }
          },
          update: { solvedAt: new Date() },
          create: { contestId: id, userId, problemIndex: Number(problemIndex), solvedAt: new Date() }
        })
      } else {
        await prisma.result.deleteMany({ where: { contestId: id, userId, problemIndex: Number(problemIndex) } })
      }

      const rows = await prisma.result.findMany({ where: { contestId: id } })
      const results = {}
      for (const r of rows) {
        results[r.userId] = results[r.userId] || { solved: {} }
        if (r.solvedAt) results[r.userId].solved[r.problemIndex] = true
      }

      return { ok: true, contest: {
        id: contest.id,
        problems: contest.problems,
        createdAt: contest.createdAt ? contest.createdAt.getTime() : Date.now(),
        startTime: contest.startTime ? contest.startTime.getTime() : null,
        duration: contest.durationSeconds,
        results
      } }
    })

    if (result.error) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to mark' })
  }
};