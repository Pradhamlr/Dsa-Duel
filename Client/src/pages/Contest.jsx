import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Timer from '../components/Timer'
import Toast from '../components/Toast'

// Use production backend by default if VITE_API_BASE is not set
const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

export default function Contest(){
  const { id } = useParams()
  const [contest, setContest] = useState(null)
  const [userId] = useState(() => Math.random().toString(36).slice(2,9))
  const [loading, setLoading] = useState(true)
  const [durationOverrideMin, setDurationOverrideMin] = useState('')

  useEffect(()=>{
    async function load(){
      const res = await fetch(`${API}/contest/${id}`)
      const data = await res.json()
      setContest(data)
      setLoading(false)
    }
    load()
  },[id])

  async function start(){
    const body = {}
    if (durationOverrideMin) body.duration = Number(durationOverrideMin) * 60
    await fetch(`${API}/contest/${id}/start`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    const res = await fetch(`${API}/contest/${id}`)
    const data = await res.json()
    setContest(data)
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
      const res = await fetch(`${API}/contest/${id}/mark`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, problemIndex: idx, solved }) })
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

  return (
    <div className="min-h-screen p-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Contest {id}</h2>
          <div>
            {contest.startTime ? (
              <Timer startTime={contest.startTime} duration={contest.duration} />
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" placeholder={`${Math.floor(contest.duration/60)} min`} min={5} max={480} value={durationOverrideMin} onChange={e=>setDurationOverrideMin(e.target.value)} className="p-2 border rounded" />
                <button onClick={start} className="bg-green-600 text-white px-3 py-1 rounded">Start Contest</button>
                <button onClick={async ()=>{ await navigator.clipboard.writeText(`${window.location.origin}/contest/${id}`); window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Link copied!', type:'success'}})) }} className="px-3 py-1 border rounded">Copy Link</button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {contest.problems.map((p, i) => (
            <div key={i} className="p-4 border rounded flex justify-between items-center">
              <div>
                <div className="font-medium">{i+1}. {p.title}</div>
                <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noreferrer" className="text-blue-500 text-sm">Open on LeetCode</a>
              </div>
              <div className="flex items-center gap-2">
                {/* Only allow marking after the contest has started */}
                {contest.startTime ? (
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
        <Toast />
      </div>
    </div>
  )
}