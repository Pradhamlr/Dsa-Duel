import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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

  if (loading) return <div className="p-6">Loading...</div>
  if (!contest) return <div className="p-6">Contest not found</div>

  // helper: is contest over according to server data
  const nowMs = Date.now()
  const contestEndMs = contest.startTime ? (contest.startTime + contest.duration * 1000) : null
  const isOver = ended || (contestEndMs !== null && nowMs >= contestEndMs)

  function renderLeaderboard(){
    const rows = []
    const results = contest.results || {}
    for (const uid of Object.keys(results)){
      const solvedMap = results[uid].solved || {}
      const solvedCount = Object.keys(solvedMap).filter(k=>solvedMap[k]).length
      const name = results[uid].name || null
      rows.push({ userId: uid, name, solvedCount })
    }
    rows.sort((a,b)=> b.solvedCount - a.solvedCount)
    if (rows.length === 0) return <div className="text-sm text-gray-600">No results yet.</div>
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Results</h3>
        <div className="bg-white border rounded">
          <div className="grid grid-cols-3 gap-2 p-3 font-medium border-b"> <div>Rank</div><div>User</div><div>Solved</div></div>
          {rows.map((r, idx) => (
            <div key={r.userId} className="grid grid-cols-3 gap-2 p-3 items-center border-b last:border-b-0">
              <div>{idx+1}</div>
              <div className="truncate">{r.name || r.userId}</div>
              <div>{r.solvedCount}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Contest {id}</h2>
            {contest.creatorName || contest.creatorId ? (
              <div className="text-sm text-gray-600">Created by {contest.creatorName ? contest.creatorName : contest.creatorId}</div>
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
                  }} className="bg-green-600 text-white px-3 py-1 rounded">Start Contest</button>
                )}
                <button onClick={async ()=>{ await navigator.clipboard.writeText(`${window.location.origin}/contest/${id}`); window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Link copied!', type:'success'}})) }} className="px-3 py-1 border rounded">Copy Link</button>
              </div>
            )}
          </div>
        </div>

        {isOver ? (
          renderLeaderboard()
        ) : (
          <div className="space-y-3">
            {contest.problems.map((p, i) => (
              <div key={i} className="p-4 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{i+1}. {p.title}</div>
                  <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noreferrer" className="text-blue-500 text-sm">Open on LeetCode</a>
                </div>
                <div className="flex items-center gap-2">
                  {/* Only allow marking after the contest has started */}
                  {contest.startTime && !ended ? (
                    (() => {
                      const solved = contest.results && contest.results[userId] && contest.results[userId].solved && contest.results[userId].solved[i]
                      if (solved) {
                        return <button onClick={()=>mark(i, false)} className="px-3 py-1 bg-green-600 text-white rounded">Solved</button>
                      }
                      return <button onClick={()=>mark(i, true)} className="px-3 py-1 border rounded">Mark Solved</button>
                    })()
                  ) : (
                    <div className="text-sm text-gray-500 italic">Contest not started</div>
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