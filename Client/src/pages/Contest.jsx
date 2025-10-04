import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Timer from '../components/Timer'
import Toast from '../components/Toast'

// Use production backend by default if VITE_API_BASE is not set
const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

export default function Contest(){
  const { id } = useParams()
  const [contest, setContest] = useState(null)
  const [userId] = useState(() => {
    try {
      const existing = localStorage.getItem('duel_userId')
      if (existing) return existing
      const id = Math.random().toString(36).slice(2,9)
      localStorage.setItem('duel_userId', id)
      return id
    } catch (err) {
      // localStorage may not be available in some environments; fall back
      return Math.random().toString(36).slice(2,9)
    }
  })
  const [loading, setLoading] = useState(true)
  const [ended, setEnded] = useState(false)
  const [durationOverrideMin, setDurationOverrideMin] = useState('')
  const [selectedSort, setSelectedSort] = useState('solved-desc')
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem('duel_name') || '' } catch { return '' }
  })
  const navigate = useNavigate()

  useEffect(()=>{
    async function load(){
      try {
        const res = await fetch(`${API}/contest/${id}`)
        if (!res.ok) throw new Error('Failed to load contest')
        const data = await res.json()
        setContest(data)
      } catch (err) {
        console.error('load error', err)
        window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: 'Failed to load contest', type:'error'}}))
      } finally {
        setLoading(false)
      }
    }
    load()
  },[id])

  // Poll status every 3s for participants so they see when the creator starts the contest
  useEffect(()=>{
    if (!contest) return
    // if contest already started, nothing to do
    if (contest.startTime) return
    let cancelled = false
    const interval = setInterval(async ()=>{
      try {
        const res = await fetch(`${API}/contest/${id}/status`)
        if (!res.ok) return
        const s = await res.json()
        if (s && s.startTime) {
          // fetch full contest and update
          const r = await fetch(`${API}/contest/${id}`)
          if (!r.ok) return
          const updated = await r.json()
          if (!cancelled) {
            setContest(updated)
            window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Contest started', type:'info'}}))
          }
        }
      } catch (e) {
        // ignore network errors during polling
      }
    }, 3000)
    return ()=>{ cancelled = true; clearInterval(interval) }
  }, [contest, id])

  async function start(){
    const body = {}
    if (durationOverrideMin) body.duration = Number(durationOverrideMin) * 60
    body.callerId = userId
    await startWithBody(body)
  }

  async function startWithBody(body){
    try {
      const res = await fetch(`${API}/contest/${id}/start`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(()=>({ error: 'failed' }))
        throw new Error(err.error || 'Failed to start')
      }
      const r2 = await fetch(`${API}/contest/${id}`)
      const data = await r2.json()
      setContest(data)
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: 'Contest started', type:'success'}}))
    } catch (err) {
      console.error('start error', err)
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: err.message || 'Failed to start', type:'error'}}))
    }
  }

  async function mark(idx, solved){
    // optimistic update: reflect immediately in UI
    setContest(prev => {
      if (!prev) return prev
      const copy = JSON.parse(JSON.stringify(prev))
      copy.results = copy.results || {}
      copy.results[userId] = copy.results[userId] || { solved: {} }
      copy.results[userId].solved = copy.results[userId].solved || {}
      copy.results[userId].solved[idx] = !!solved
      return copy
    })

    try {
      const displayName = localStorage.getItem('duel_name') || null
      const res = await fetch(`${API}/contest/${id}/mark`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, problemIndex: idx, solved, displayName }) })
      if (!res.ok) throw new Error('mark failed')
      const data = await res.json()
      if (data && data.contest) {
        setContest(data.contest)
      } else {
        // backend might not return contest (older/prod), refetch to refresh
        const r2 = await fetch(`${API}/contest/${id}`)
        const updated = await r2.json()
        setContest(updated)
      }
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: solved ? 'Marked solved' : 'Unmarked', type:'success'}}))
    } catch (err) {
      console.error('mark error', err)
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: 'Failed to mark', type:'error'}}))
    }
  }

  async function saveName(){
    try {
      localStorage.setItem('duel_name', displayName || '')
      // upsert via backend so leaderboard shows name immediately
      await fetch(`${API}/user`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, name: displayName }) })
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Name saved', type:'success'}}))
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Failed to save name', type:'error'}}))
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!contest) return <div className="p-6">Contest not found</div>

  // helper: is contest over according to server data
  const nowMs = Date.now()
  const contestEndMs = contest.startTime ? (contest.startTime + contest.duration * 1000) : null
  const isOver = ended || (contestEndMs !== null && nowMs >= contestEndMs)

  // derive problem types using simple heuristics on title/slug
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

  const problemTypes = contest.problems.map(getProblemType)

  function renderLeaderboard(){
    const rows = []
    const results = contest.results || {}
    for (const uid of Object.keys(results)){
      const solvedMap = results[uid].solved || {}
        // count all solved problems
        const solvedCount = Object.keys(solvedMap).filter(k => solvedMap[k]).length
      const name = results[uid].name || null
      rows.push({ userId: uid, name, solvedCount })
    }
  // default sort: solved desc
  rows.sort((a,b)=> b.solvedCount - a.solvedCount)
  // apply selectedSort
  if (selectedSort === 'name-asc') rows.sort((a,b)=> (a.name || a.userId).localeCompare(b.name || b.userId))
  if (selectedSort === 'solved-asc') rows.sort((a,b)=> a.solvedCount - b.solvedCount)
  if (selectedSort === 'solved-desc') rows.sort((a,b)=> b.solvedCount - a.solvedCount || (a.name||a.userId).localeCompare(b.name||b.userId))
  if (rows.length === 0) return <div className="text-sm muted">No results yet.</div>
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Results</h3>
            <div className="flex items-center gap-2">
            <select value={selectedSort} onChange={e=>setSelectedSort(e.target.value)} className="p-1 border rounded">
              <option value="solved-desc">Solved (desc)</option>
              <option value="solved-asc">Solved (asc)</option>
              <option value="name-asc">Name (A→Z)</option>
            </select>
            <button onClick={()=>navigate('/')} className="btn-secondary">Back to Home</button>
          </div>
        </div>
        <div className="card leader-rows">
          <div className="grid grid-cols-3 gap-2 p-3 font-medium border-b"> <div>Rank</div><div>User</div><div className="text-right">Solved</div></div>
          {rows.map((r, idx) => (
            <div key={r.userId} className={"leader-row " + (r.userId === userId ? 'leader-current' : '')}>
              <div className="text-sm">{idx+1}</div>
              <div>
                <div className="user-name">{r.name || r.userId}</div>
                <div className="user-id">{r.name ? r.userId : ''}</div>
              </div>
              <div className="leader-count">{r.solvedCount}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-2 sm:p-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold">Contest {id}</h2>
            {contest.creatorName || contest.creatorId ? (
              <div className="text-sm muted">Created by {contest.creatorName ? contest.creatorName : contest.creatorId}</div>
            ) : null}
          </div>
    <div>
      {contest.startTime ? (
                    <Timer startTime={contest.startTime} duration={contest.duration} onEnd={async ()=>{
                      // mark ended locally and refresh contest from server
                      setEnded(true)
                      try {
                        const r = await fetch(`${API}/contest/${id}`)
                        if (r.ok){
                          const d = await r.json()
                          setContest(d)
                        }
                      } catch (e) { /* no-op */ }
                      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Contest ended', type:'info'}}))
                    }} />
                  ) : (
        <div className="flex items-center gap-2">
          <input type="number" placeholder={`${Math.floor(contest.duration/60)} min`} min={5} max={480} value={durationOverrideMin} onChange={e=>setDurationOverrideMin(e.target.value)} className="p-2 border rounded" />
                {contest.creatorId && contest.creatorId !== userId ? (
                  <div className="text-sm text-gray-500 italic">Only creator can start</div>
                ) : (
                  <button onClick={async ()=>{
                    const body = {}
                    if (durationOverrideMin) body.duration = Number(durationOverrideMin) * 60
                    body.callerId = userId
                    await startWithBody(body)
                  }} className="btn-primary">Start Contest</button>
                )}
                <button onClick={async ()=>{ await navigator.clipboard.writeText(`${window.location.origin}/contest/${id}`); window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Link copied!', type:'success'}})) }} className="btn-neutral">Copy Link</button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Enter display name" className="p-2 border rounded w-full sm:w-auto" />
          <button onClick={saveName} className="btn-accent btn-sm">Save name</button>
          <div className="text-sm muted">Name shown on leaderboard</div>
        </div>

        {!isOver && (
          <div className="mb-4 flex items-center justify-end">
            <div>
              <button onClick={()=>navigate('/')} className="btn-neutral">Back to Home</button>
            </div>
          </div>
        )}

        

        {isOver ? (
          renderLeaderboard()
        ) : (
          <div className="space-y-3">
            {contest.problems.map((p, i) => (
                    <div key={i} className="p-3 sm:p-4 border rounded flex flex-col sm:flex-row sm:justify-between items-start sm:items-center problem-card">
                  <div className="flex-1 min-w-0 mb-3 sm:mb-0">
                    <div className="font-medium">{i+1}. {p.title}</div>
                        <div className="text-sm muted">{problemTypes[i]}</div>
                    <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noreferrer" className="text-sm" style={{color:'var(--accent)'}}>Open on LeetCode</a>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Only allow marking after the contest has started */}
                    {contest.startTime && !ended ? (
                      (() => {
                        const solved = contest.results && contest.results[userId] && contest.results[userId].solved && contest.results[userId].solved[i]
                        if (solved) {
                          return <button onClick={()=>mark(i, false)} className="btn-solved">Solved</button>
                        }
                        return <button onClick={()=>mark(i, true)} className="btn-accent btn-sm">Mark Solved</button>
                      })()
                    ) : (
                      <div className="text-sm muted italic">Contest not started</div>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}
        <Toast />
      </div>
    </div>
  )
}