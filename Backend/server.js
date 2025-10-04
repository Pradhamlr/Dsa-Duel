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

let prisma
function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}

const app = express();
const allowedOrigins = [
  'https://dsa-duel.vercel.app', // your frontend domain
  'http://localhost:5173'         // optional, for local dev
]

const corsOptions = {
  origin: function (origin, callback) {
    // Log incoming origin for debugging (visible in Render logs)
    console.log('CORS check, origin:', origin)
    // Allow non-browser or same-origin requests (e.g., server-to-server)
    if (!origin) return callback(null, true)

    // direct match to whitelist
    if (allowedOrigins.includes(origin)) return callback(null, true)

    // allow vercel subdomains (helps when your frontend is deployed on vercel preview links)
    try {
      if (typeof origin === 'string' && origin.endsWith('.vercel.app')) return callback(null, true)
    } catch (e) { /* ignore */ }

    // otherwise reject
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.'
    return callback(new Error(msg), false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true, // if you need cookies / auth headers
  optionsSuccessStatus: 200, // some legacy browsers choke without this
}

// Apply CORS to all routes
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
    // API accepts: { numProblems, difficulty, duration }
    // duration is in seconds (frontend will typically send minutes * 60)
    const { numProblems = 5, difficulty = 'mixed', duration } = req.body || {};
    const pool = await fetchLeetCodePool();

    // Optionally filter by difficulty param if "Easy" or "Medium"
    let filtered = (difficulty === 'Easy' || difficulty === 'Medium')
      ? pool.filter(p => p.difficulty === difficulty)
      : pool;

    // Optional topic filtering (frontend may send topic: 'Array', 'Tree', etc.)
    const topic = req.body && req.body.topic ? req.body.topic : null
    if (topic) {
      const byTopic = filtered.filter(p => getProblemType(p) === topic)
      if (byTopic.length < numProblems) {
        // Not enough problems of that topic; respond with error
        return res.status(400).json({ error: 'Not enough problems for selected topic' })
      }
      filtered = byTopic
    }

    if (filtered.length < numProblems) return res.status(500).json({ error: 'Not enough problems' });

    // pick random unique problems
    const chosen = [];
    const used = new Set();
    while (chosen.length < numProblems) {
      const idx = Math.floor(Math.random() * filtered.length);
      if (!used.has(idx)) { used.add(idx); chosen.push(filtered[idx]); }
    }

    // persist contest in DB using Prisma
    const id = randomUUID().slice(0,8);
    const durationSeconds = duration && Number.isFinite(Number(duration)) ? Number(duration) : 90 * 60

    // If creator info is provided, ensure user exists (avoid FK) and store creatorId
    let creatorId = null
    let creatorName = null
    if (req.body && req.body.creatorId) {
      creatorId = req.body.creatorId
      creatorName = req.body.creatorName || null
      try {
        await getPrisma().user.upsert({ where: { id: creatorId }, update: { name: creatorName || undefined }, create: { id: creatorId, name: creatorName || undefined } })
      } catch (e) {
        console.error('User upsert error:', e)
      }
    }

    const created = await getPrisma().contest.create({
      data: {
        id,
        numProblems: Number(numProblems),
        difficulty,
        problems: chosen,
        durationSeconds,
        creatorId
      }
    })

    res.json({ contestId: created.id, problems: chosen });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create' });
  }
});

app.get('/contest/:id', async (req, res) => {
  try {
    const id = req.params.id
    const c = await getPrisma().contest.findUnique({ where: { id } })
    if (!c) return res.status(404).json({ error: 'not found' });

    // load results for this contest
    const rows = await getPrisma().result.findMany({ where: { contestId: id } })
    const results = {}
    const userIds = new Set()
    for (const r of rows) {
      userIds.add(r.userId)
      results[r.userId] = results[r.userId] || { solved: {} }
      if (r.solvedAt) results[r.userId].solved[r.problemIndex] = true
    }

    // fetch user names for participants (if any)
    let nameMap = {}
    if (userIds.size > 0) {
      const users = await getPrisma().user.findMany({ where: { id: { in: Array.from(userIds) } } })
      nameMap = users.reduce((acc, u) => { acc[u.id] = u.name || null; return acc }, {})
      for (const uid of Object.keys(results)) {
        results[uid].name = nameMap[uid] || null
      }
    }

    // include creator info if present
    let creatorName = null
    if (c.creatorId) {
      const user = await getPrisma().user.findUnique({ where: { id: c.creatorId } })
      creatorName = user ? user.name : null
    }

    res.json({
      id: c.id,
      problems: c.problems,
      createdAt: c.createdAt ? c.createdAt.getTime() : Date.now(),
      startTime: c.startTime ? c.startTime.getTime() : null,
      duration: c.durationSeconds,
      results,
      creatorId: c.creatorId || null,
      creatorName
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed' })
  }
})

app.post('/contest/:id/start', async (req, res) => {
  try {
    const id = req.params.id
    const contest = await getPrisma().contest.findUnique({ where: { id } })
    if (!contest) return res.status(404).json({ error: 'not found' })
    if (contest.startTime) return res.status(400).json({ error: 'already started' })

    const { duration, callerId } = req.body || {}

    // If a creator is set on the contest, only allow that creator to start
    if (contest.creatorId && callerId && contest.creatorId !== callerId) {
      return res.status(403).json({ error: 'only creator can start' })
    }

    const update = { startTime: new Date() }
    if (duration && Number.isFinite(duration)) update.durationSeconds = Number(duration)

    const updated = await getPrisma().contest.update({ where: { id }, data: update })
    res.json({ startedAt: updated.startTime ? updated.startTime.getTime() : Date.now(), duration: updated.durationSeconds })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to start' })
  }
})

app.get('/contest/:id/status', async (req, res) => {
  try {
    const id = req.params.id
    const c = await getPrisma().contest.findUnique({ where: { id } })
    if (!c) return res.status(404).json({ error: 'not found' })
    res.json({ startTime: c.startTime ? c.startTime.getTime() : null, duration: c.durationSeconds })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed' })
  }
})

// small endpoint to toggle mark solved by a user
app.post('/contest/:id/mark', async (req, res) => {
  try {
    const id = req.params.id
    const { userId, problemIndex, solved, displayName } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const contest = await getPrisma().contest.findUnique({ where: { id } })
    if (!contest) return res.status(404).json({ error: 'not found' })
    if (!contest.startTime) return res.status(400).json({ error: 'contest not started' })

    if (solved) {
      // Ensure the user row exists (prevents FK violation)
      // If client supplied a displayName, persist it
      try {
        await getPrisma().user.upsert({
          where: { id: userId },
          update: { name: displayName || undefined },
          create: { id: userId, name: displayName || undefined }
        })
      } catch (e) {
        console.error('User upsert error:', e)
      }

      // upsert result
      await getPrisma().result.upsert({
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
      // unmark (delete row)
      await getPrisma().result.deleteMany({ where: { contestId: id, userId, problemIndex: Number(problemIndex) } })
    }

    // return updated contest shape
    const rows = await getPrisma().result.findMany({ where: { contestId: id } })
    const results = {}
    for (const r of rows) {
      results[r.userId] = results[r.userId] || { solved: {} }
      if (r.solvedAt) results[r.userId].solved[r.problemIndex] = true
    }

    res.json({ ok: true, contest: {
      id: contest.id,
      problems: contest.problems,
      createdAt: contest.createdAt ? contest.createdAt.getTime() : Date.now(),
      startTime: contest.startTime ? contest.startTime.getTime() : null,
      duration: contest.durationSeconds,
      results
    } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed to mark' })
  }
})

// small endpoint to upsert a user name (used by Contest page)
app.post('/user', async (req, res) => {
  try {
    const { userId, name } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId required' })
    try {
      await getPrisma().user.upsert({ where: { id: userId }, update: { name: name || undefined }, create: { id: userId, name: name || undefined } })
    } catch (e) {
      console.error('User upsert error:', e)
    }
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'failed' })
  }
})

// Overall leaderboard: simple fallback to avoid prepared statement issues
app.get('/leaderboard', async (req, res) => {
  try {
    const results = await getPrisma().result.findMany()
    const userCounts = {}
    
    for (const result of results) {
      userCounts[result.userId] = (userCounts[result.userId] || 0) + 1
    }
    
    const userIds = Object.keys(userCounts)
    const users = userIds.length ? await getPrisma().user.findMany({ where: { id: { in: userIds } } }) : []
    const nameMap = users.reduce((acc,u)=>{ acc[u.id]=u.name||null; return acc }, {})
    
    const rows = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, name: nameMap[userId]||null, solvedCount: count }))
      .sort((a,b) => b.solvedCount - a.solvedCount)
    
    res.json({ ok: true, rows })
  } catch (err) {
    console.error('leaderboard error', err)
    res.status(500).json({ error: 'failed' })
  }
})

// Debug endpoint: list recent Result rows for inspection
app.get('/debug/results', async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG_RESULTS !== 'true') {
    return res.status(403).json({ error: 'forbidden' })
  }
  try {
    const rows = await getPrisma().result.findMany({ orderBy: { id: 'desc' }, take: 100 })
    res.json({ ok: true, rows })
  } catch (err) {
    console.error('debug results error', err)
    res.status(500).json({ error: 'failed' })
  }
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Backend listening on', PORT));