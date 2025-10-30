import { withPrisma } from '../utils/database.js';

export const updateUser = async (req, res) => {
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
};

export const getLeaderboard = async (req, res) => {
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
};

export const getDebugResults = async (req, res) => {
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
};