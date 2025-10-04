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
    <div className="min-h-screen p-4 sm:p-6 flex justify-center animate-fadeIn">
      <div className="w-full max-w-4xl">
        {/* Header Card */}
        <div className="card p-6 mb-6 animate-slideIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                  Global Leaderboard
                </h1>
              </div>
              <p className="text-muted text-sm sm:text-base">
                Top performers across all contests by total problems solved
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                className="btn-neutral btn-sm" 
                onClick={()=>navigate('/')} 
                aria-label="Home"
              >
                Home
              </button>
              <button 
                className="btn-secondary btn-sm" 
                onClick={load} 
                aria-label="Refresh leaderboard"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Leaderboard Card */}
        <div className="card overflow-hidden animate-slideIn" style={{animationDelay: '0.1s'}}>
          {loading ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
                <div className="text-lg font-medium">Loading leaderboard...</div>
                <div className="text-sm text-muted">Fetching the latest rankings</div>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-xl font-semibold mb-2">No champions yet!</div>
              <div className="text-muted mb-6">Be the first to appear on the leaderboard by participating in contests</div>
              <button 
                onClick={()=>navigate('/')} 
                className="btn-primary mx-auto"
              >
                Create Your First Contest
              </button>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{display: 'grid', gridTemplateColumns: '60px 1fr 120px'}} className="gap-4 p-4 font-semibold border-b bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
                <div>Rank</div>
                <div>Participant</div>
                <div className="text-right">Total Solved</div>
              </div>
              
              {/* Leaderboard Rows */}
              <div>
                {rows.map((r, idx) => {
                  const isTopThree = idx < 3
                  const isCurrentUser = r.userId === (localStorage.getItem('duel_userId') || '')
                  const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`
                  
                  return (
                    <div 
                      key={r.userId} 
                      style={{display: 'grid', gridTemplateColumns: '60px 1fr 120px', animationDelay: `${0.05 * idx}s`}}
                      className={`gap-4 p-4 border-b last:border-b-0 animate-slideIn ${
                        isCurrentUser ? 'leader-current' : ''
                      } ${isTopThree ? 'font-semibold' : ''}`}
                    >
                      <div className="flex items-center">
                        <span className={`${isTopThree ? 'text-xl' : 'text-lg'}`}>
                          {rankEmoji}
                        </span>
                      </div>
                      
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {r.name || r.userId}
                          {isCurrentUser && (
                            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}

                        </div>
                        {r.name && <div className="text-xs text-muted">{r.userId}</div>}
                      </div>
                      
                      <div className="text-right">
                        <span className={`font-bold ${isTopThree ? 'text-xl' : 'text-lg'}`}>
                          {r.solvedCount}
                        </span>
                        <span className="text-sm text-muted ml-1">problems</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Stats Card */}
        {!loading && rows.length > 0 && (
          <div className="card p-6 mt-6 animate-slideIn" style={{animationDelay: '0.2s'}}>
            <h3 className="text-lg font-semibold mb-4">
              Leaderboard Stats
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{rows.length}</div>
                <div className="text-sm text-muted">Total Participants</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {rows.length > 0 ? Math.max(...rows.map(r => r.solvedCount)) : 0}
                </div>
                <div className="text-sm text-muted">Highest Score</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.solvedCount, 0) / rows.length) : 0}
                </div>
                <div className="text-sm text-muted">Average Score</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
