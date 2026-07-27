import { withPrisma } from '../utils/database.js';

export const updateUser = async (req, res) => {
  try {
    // Always the caller's own verified id -- never trust a client-supplied userId here,
    // or any authenticated user could rename any other user.
    const userId = req.user.userId
    const { name } = req.body || {}

    await withPrisma(async (prisma) => {
      try {
        await prisma.user.update({ where: { id: userId }, data: { name: name || undefined } })
      } catch (e) {
        console.error('User update error:', e)
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