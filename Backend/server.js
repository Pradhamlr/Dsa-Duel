/*
Simple Express backend with in-memory contest store.
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

const app = express();
app.use(cors());
app.use(express.json());

const contests = {}; // { id: { problems: [], createdAt, startTime, duration, results: { userId: {...} } } }

// Helper: fetch leetcode problems
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

app.post('/create-contest', async (req, res) => {
  try {
    // API accepts: { numProblems, difficulty, duration }
    // duration is in seconds (frontend will typically send minutes * 60)
    const { numProblems = 5, difficulty = 'mixed', duration } = req.body || {};
    const pool = await fetchLeetCodePool();

    // Optionally filter by difficulty param if "Easy" or "Medium"
    const filtered = (difficulty === 'Easy' || difficulty === 'Medium')
      ? pool.filter(p => p.difficulty === difficulty)
      : pool;

    if (filtered.length < numProblems) return res.status(500).json({ error: 'Not enough problems' });

    // pick random unique problems
    const chosen = [];
    const used = new Set();
    while (chosen.length < numProblems) {
      const idx = Math.floor(Math.random() * filtered.length);
      if (!used.has(idx)) { used.add(idx); chosen.push(filtered[idx]); }
    }

    const id = randomUUID().slice(0,8);
    contests[id] = {
      id,
      problems: chosen,
      createdAt: Date.now(),
      startTime: null,
      // use provided duration when valid (number), otherwise default 90 minutes
      duration: duration && Number.isFinite(Number(duration)) ? Number(duration) : 90 * 60,
      results: {}
    };

    res.json({ contestId: id, problems: chosen });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create' });
  }
});

app.get('/contest/:id', (req, res) => {
  const c = contests[req.params.id];
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(c);
});

app.post('/contest/:id/start', (req, res) => {
  const c = contests[req.params.id];
  if (!c) return res.status(404).json({ error: 'not found' });
  if (c.startTime) return res.status(400).json({ error: 'already started' });

  const { duration } = req.body || {}; // seconds
  if (duration && Number.isFinite(duration)) c.duration = Number(duration);
  c.startTime = Date.now();
  res.json({ startedAt: c.startTime, duration: c.duration });
});

app.get('/contest/:id/status', (req, res) => {
  const c = contests[req.params.id];
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json({ startTime: c.startTime, duration: c.duration });
});

// small endpoint to toggle mark solved by a user
app.post('/contest/:id/mark', (req, res) => {
  const c = contests[req.params.id];
  if (!c) return res.status(404).json({ error: 'not found' });
  const { userId, problemIndex, solved } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  c.results[userId] = c.results[userId] || { solved: {} };
  c.results[userId].solved[problemIndex] = !!solved;
  res.json({ ok: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Backend listening on', PORT));