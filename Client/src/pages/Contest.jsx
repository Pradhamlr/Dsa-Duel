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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 flex flex-col items-center gap-4">
          <div className="animate-spin h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          <div className="text-lg font-medium">Loading contest...</div>
        </div>
      </div>
    )
  }
  
  if (!contest) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 text-center">
          <div className="text-xl font-semibold mb-2">Contest not found</div>
          <div className="text-muted mb-4">The contest you're looking for doesn't exist or has been removed.</div>
          <button onClick={()=>navigate('/')} className="btn-primary">
            Go Home
          </button>
        </div>
      </div>
    )
  }

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
      const solvedCount = Object.keys(solvedMap).filter(k => solvedMap[k]).length
      const name = results[uid].name || null
      rows.push({ userId: uid, name, solvedCount })
    }
    
    rows.sort((a,b)=> b.solvedCount - a.solvedCount)
    if (selectedSort === 'name-asc') rows.sort((a,b)=> (a.name || a.userId).localeCompare(b.name || b.userId))
    if (selectedSort === 'solved-asc') rows.sort((a,b)=> a.solvedCount - b.solvedCount)
    if (selectedSort === 'solved-desc') rows.sort((a,b)=> b.solvedCount - a.solvedCount || (a.name||a.userId).localeCompare(b.name||b.userId))
    
    if (rows.length === 0) {
      return (
        <div className="card p-8 text-center">
          <div className="text-lg font-medium mb-2">No results yet</div>
          <div className="text-sm text-muted">Results will appear here once participants start solving problems</div>
        </div>
      )
    }
    
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Final Results</h2>
          <select 
            value={selectedSort} 
            onChange={e=>setSelectedSort(e.target.value)} 
            className="text-sm border rounded px-2 py-1"
          >
            <option value="solved-desc">Most Solved</option>
            <option value="solved-asc">Least Solved</option>
            <option value="name-asc">Name A→Z</option>
          </select>
        </div>
        
        <div className="card">
          <div style={{display: 'grid', gridTemplateColumns: '60px 1fr 80px'}} className="gap-4 p-3 font-medium border-b text-sm">
            <div>Rank</div>
            <div>Participant</div>
            <div className="text-right">Solved</div>
          </div>
          
          {rows.map((r, idx) => {
            const isCurrentUser = r.userId === userId
            
            return (
              <div 
                key={r.userId} 
                style={{display: 'grid', gridTemplateColumns: '60px 1fr 80px'}}
                className={`gap-4 p-3 border-b last:border-b-0 ${isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
              >
                <div className="flex items-center">
                  <span className="font-medium">
                    {idx === 0 && r.solvedCount > 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}
                  </span>
                </div>
                <div>
                  <div className="font-medium">
                    {r.name || r.userId}
                    {isCurrentUser && <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">You</span>}
                  </div>
                  {r.name && <div className="text-xs text-muted">{r.userId}</div>}
                </div>
                <div className="text-right font-semibold">
                  {r.solvedCount} / {contest.problems?.length || 0}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 flex justify-center animate-fadeIn">
      <div className="w-full max-w-4xl">
        {/* Header Card */}
        <div className="card p-6 mb-6 animate-slideIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                  Contest {id}
                </h1>
                
              </div>
              {contest.creatorName || contest.creatorId ? (
                <div className="text-sm text-muted">
                  Created by <span className="font-medium">{contest.creatorName || contest.creatorId}</span>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {contest.startTime ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Time Remaining:</span>
                    <Timer startTime={contest.startTime} duration={contest.duration} onEnd={async ()=>{
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
                  </div>
                  <button 
                    onClick={async ()=>{ 
                      await navigator.clipboard.writeText(`${window.location.origin}/contest/${id}`); 
                      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Link copied!', type:'success'}})) 
                    }} 
                    className="btn-neutral btn-sm"
                  >
                    Copy Link
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <input 
                    type="number" 
                    placeholder={`${Math.floor(contest.duration/60)} min`} 
                    min={5} 
                    max={480} 
                    value={durationOverrideMin} 
                    onChange={e=>setDurationOverrideMin(e.target.value)} 
                    className="w-24" 
                    style={{appearance: 'textfield'}}
                  />
                  {contest.creatorId && contest.creatorId !== userId ? (
                    <div className="text-sm text-muted italic">
                      Only creator can start
                    </div>
                  ) : (
                    <button 
                      onClick={async ()=>{
                        const body = {}
                        if (durationOverrideMin) body.duration = Number(durationOverrideMin) * 60
                        body.callerId = userId
                        await startWithBody(body)
                      }} 
                      className="btn-primary"
                    >
                      Start Contest
                    </button>
                  )}
                  <button 
                    onClick={async ()=>{ 
                      await navigator.clipboard.writeText(`${window.location.origin}/contest/${id}`); 
                      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Link copied!', type:'success'}})) 
                    }} 
                    className="btn-neutral btn-sm"
                  >
                    Copy Link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Info Card */}
        <div className="card p-4 mb-6 animate-slideIn" style={{animationDelay: '0.1s'}}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">
                Your Display Name
              </label>
              <input 
                value={displayName} 
                onChange={e=>setDisplayName(e.target.value)} 
                placeholder="Enter your display name" 
                className="w-full sm:w-64" 
              />
            </div>
            <button 
              onClick={saveName} 
              className="btn-accent btn-sm"
            >
              Save Name
            </button>
            
          </div>
        </div>



        

        {isOver ? (
          <div className="animate-slideIn" style={{animationDelay: '0.2s'}}>
            {renderLeaderboard()}
            <div className="mt-6 text-center">
              <button 
                onClick={()=>navigate('/')} 
                className="btn-secondary mx-auto"
              >
                Back to Home
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                Problems
              </h2>
              <button 
                onClick={()=>navigate('/')} 
                className="btn-neutral btn-sm flex items-center gap-2"
              >
                🏠 Home
              </button>
            </div>
            
            <div className="grid gap-4">
              {contest.problems.map((p, i) => {
                const solved = contest.results && contest.results[userId] && contest.results[userId].solved && contest.results[userId].solved[i]
                const difficultyColor = p.difficulty === 'Easy' ? 'text-green-500' : p.difficulty === 'Medium' ? 'text-yellow-500' : 'text-red-500'
                const difficultyEmoji = p.difficulty === 'Easy' ? '🟢' : p.difficulty === 'Medium' ? '🟡' : '🔴'
                
                return (
                  <div 
                    key={i} 
                    className={`problem-card p-6 animate-slideIn ${solved ? 'border-green-400' : ''}`}
                    style={{animationDelay: `${0.1 * (i + 1)}s`}}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {i+1}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{p.title}</h3>
                            <div className="flex items-center gap-3 text-sm">
                              <span className={`flex items-center gap-1 ${difficultyColor}`}>
                                {difficultyEmoji} {p.difficulty || 'Medium'}
                              </span>
                              <span className="text-muted flex items-center gap-1">
                                🏷️ {problemTypes[i]}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <a 
                          href={`https://leetcode.com/problems/${p.slug}/`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                        >
                          Open on LeetCode →
                        </a>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {contest.startTime && !ended ? (
                          solved ? (
                            <button 
                              onClick={()=>mark(i, false)} 
                              className="btn-solved flex items-center gap-2"
                            >
                              Solved
                            </button>
                          ) : (
                            <button 
                              onClick={()=>mark(i, true)} 
                              className="btn-accent"
                            >
                              Mark Solved
                            </button>
                          )
                        ) : (
                          <div className="text-sm text-muted italic">
                            Contest not started
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <Toast />
      </div>
    </div>
  )
}