import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Use same API default pattern as other pages
const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

export default function Leaderboard(){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function load(){
    setLoading(true)
    try {
      const res = await fetch(`${API}/leaderboard`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setRows(data.rows || [])
    } catch (e) {
      console.error(e)
      setRows([])
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  return (
    <div className="min-h-screen p-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="card p-6 mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">Overall Leaderboard</h1>
            <p className="muted">Top users across all contests by total solved problems.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={()=>navigate('/')} aria-label="Home">Home</button>
            <button onClick={load} aria-label="Refresh leaderboard">Refresh</button>
          </div>
        </div>

        <div className="card p-4">
          {loading ? (
            <div className="text-center p-6">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center p-6 muted">No data yet</div>
          ) : (
            <div className="leader-rows">
              <div className="grid grid-cols-3 gap-2 p-3 font-medium border-b items-center"> <div>Rank</div><div>User</div><div className="text-right">Solved</div></div>
              {rows.map((r, idx)=> (
                <div key={r.userId} className={`leader-row ${r.userId === (localStorage.getItem('duel_userId')||'') ? 'leader-current' : ''}`}>
                  <div className="text-sm">{idx+1}</div>
                  <div className="user-col">
                    <div className="user-name">{r.name || r.userId}</div>
                    <div className="user-id">{r.name ? r.userId : ''}</div>
                  </div>
                  <div className="leader-count">{r.solvedCount}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
