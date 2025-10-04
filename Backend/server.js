/*
Endpoints:
- POST /create-contest  { numProblems, difficulty }
- GET  /contest/:id     -> contest object
- POST /contest/:id/start -> sets startTime and duration
- GET  /contest/:id/status -> returns startTime, duration, timeLeft
*/

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client'

async function withPrisma(callback) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    log: ['error'],
    errorFormat: 'minimal'
  })
  
  try {
    return await callback(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

const app = express();
const allowedOrigins = [
  'https://dsa-duel.vercel.app',
  'http://localhost:5173'
]

const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS check, origin:', origin)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    try {
      if (typeof origin === 'string' && origin.endsWith('.vercel.app')) return callback(null, true)
    } catch (e) { /* ignore */ }
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.'
    return callback(new Error(msg), false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions));
app.use(express.json());

async function fetchLeetCodePool() {
  const res = await fetch('https://leetcode.com/api/problems/all/');
  const data = await res.json();
  const pool = data.stat_status_pairs
    .filter(q => !q.paid_only)
    .map(q => ({
      title: q.stat.question__title,
      slug: q.stat.question__title_slug,
      difficulty: ['','Easy','Medium','Hard'][q.difficulty.level]
    }))
    .filter(q => ['Easy','Medium'].includes(q.difficulty));
  return pool;
}

function getProblemType(p){
  const txt = (p.title || p.slug || '').toLowerCase()
  if (/\b(linked ?list|linked-list)\b/.test(txt)) return 'Linked List'
  if (/\b(tree|binary tree|bst)\b/.test(txt)) return 'Tree'
  if (/\b(graph|dfs|bfs)\b/.test(txt)) return 'Graph'
  if (/\b(array|arrays?)\b/.test(txt)) return 'Array'
  if (/\b(string|strings?)\b/.test(txt)) return 'String'
  if (/\b(dynamic programming|dp)\b/.test(txt)) return 'DP'
  if (/\b(stack|queue|deque)\b/.test(txt)) return 'Stack/Queue'
  if (/\b(matrix|grid)\b/.test(txt)) return 'Matrix'
  if (/\b(hash|map|unordered)\b/.test(txt)) return 'Hash / Map'
  if (/\b(binary search|search)\b/.test(txt)) return 'Binary Search'
  if (/\b(two ?pointers|two-pointers)\b/.test(txt)) return 'Two Pointers'
  return 'Other'
}

app.post('/create-contest', async (req, res) => {
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

      let creatorId = null
      let creatorName = null
      if (req.body && req.body.creatorId) {
        creatorId = req.body.creatorId
        creatorName = req.body.creatorName || null
        try {
          await prisma.user.upsert({ where: { id: creatorId }, update: { name: creatorName || undefined }, create: { id: creatorId, name: creatorName || undefined } })
        } catch (e) {
          console.error('User upsert error:', e)
        }
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
});

app.get('/contest/:id', async (req, res) => {
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
})

app.post('/contest/:id/start', async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const id = req.params.id
      const contest = await prisma.contest.findUnique({ where: { id } })
      if (!contest) return { error: 'not found', status: 404 }
      if (contest.startTime) return { error: 'already started', status: 400 }

      const { duration, callerId } = req.body || {}

      if (contest.creatorId && callerId && contest.creatorId !== callerId) {
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
})

app.get('/contest/:id/status', async (req, res) => {
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
})

app.post('/contest/:id/mark', async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const id = req.params.id
      const { userId, problemIndex, solved, displayName } = req.body
      if (!userId) return { error: 'userId required', status: 400 }

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
})

app.post('/user', async (req, res) => {
  try {
    await withPrisma(async (prisma) => {
      const { userId, name } = req.body || {}
      if (!userId) return res.status(400).json({ error: 'userId required' })
      try {
        await prisma.user.upsert({ where: { id: userId }, update: { name: name || undefined }, create: { id: userId, name: name || undefined } })
      } catch (e) {
        console.error('User upsert error:', e)
      }
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed' })
  }
})

app.get('/leaderboard', async (req, res) => {
  try {
    const result = await withPrisma(async (prisma) => {
      const results = await prisma.result.findMany()
      const userCounts = {}
      
      for (const result of results) {
        userCounts[result.userId] = (userCounts[result.userId] || 0) + 1
      }
      
      const userIds = Object.keys(userCounts)
      const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } } }) : []
      const nameMap = users.reduce((acc,u)=>{ acc[u.id]=u.name||null; return acc }, {})
      
      const rows = Object.entries(userCounts)
        .map(([userId, count]) => ({ userId, name: nameMap[userId]||null, solvedCount: count }))
        .sort((a,b) => b.solvedCount - a.solvedCount)
      
      return { ok: true, rows }
    })
    
    res.json(result)
  } catch (err) {
    console.error('leaderboard error', err)
    res.status(500).json({ error: 'failed' })
  }
})

app.get('/debug/results', async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG_RESULTS !== 'true') {
    return res.status(403).json({ error: 'forbidden' })
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
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Backend listening on', PORT));