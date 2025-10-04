import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'

// Use production backend by default if VITE_API_BASE is not set
const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

export default function Home(){
  const [num, setNum] = useState(5)
  const [difficulty, setDifficulty] = useState('mixed')
  const [topic, setTopic] = useState('All')
  const [durationMin, setDurationMin] = useState(90)
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem('duel_name') || '' } catch { return '' }
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [createdLink, setCreatedLink] = useState('')
  const [dark, setDark] = useState(() => {
    try {
      const val = localStorage.getItem('duel_dark')
      if (val === null) return true // default to dark for first-time visitors
      return val === '1'
    } catch { return true }
  })

  useEffect(()=>{
    try {
      if (dark) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
      localStorage.setItem('duel_dark', dark ? '1' : '0')
    } catch (e) {}
  }, [dark])

  async function create(){
    try {
      setLoading(true)
      // ensure user id exists
      let userId = null
      try {
        userId = localStorage.getItem('duel_userId')
        if (!userId) {
          userId = Math.random().toString(36).slice(2,9)
          localStorage.setItem('duel_userId', userId)
        }
      } catch (err) {
        userId = Math.random().toString(36).slice(2,9)
      }
      // persist display name
      try { localStorage.setItem('duel_name', displayName || '') } catch (e) {}

      const res = await fetch(`${API}/create-contest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numProblems: Number(num), difficulty, duration: Number(durationMin) * 60, creatorId: userId, creatorName: displayName })
      })

      if (!res.ok) {
        const err = await res.json().catch(()=>({ error: 'failed' }))
        throw new Error(err.error || 'Failed to create contest')
      }

      const data = await res.json()
      setLoading(false)
      if (data.contestId) {
        const url = `${window.location.origin}/contest/${data.contestId}`
        setCreatedLink(url)
        window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Contest created', type:'success'}}))
        navigate(`/contest/${data.contestId}`)
      }
    } catch (err) {
      console.error('create error', err)
      setLoading(false)
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: err.message || 'Failed to create', type:'error'}}))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-lg">
        {/* Header Card */}
        <div className="card p-6 mb-6 text-center animate-slideIn">
          <div className="mb-4">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-2">
              DSA Duel
            </h1>
            <p className="text-muted text-sm">Create competitive coding contests with friends</p>
          </div>
          <div className="flex justify-center gap-3">
            <button 
              onClick={()=>setDark(d=>!d)} 
              className="btn-neutral btn-sm" 
              aria-pressed={dark}
            >
              {dark ? 'Dark' : 'Light'}
            </button>
            <button 
              onClick={()=>navigate('/leaderboard')} 
              className="btn-secondary btn-sm"
            >
              Leaderboard
            </button>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="card p-6 animate-slideIn" style={{animationDelay: '0.1s'}}>
          <h2 className="text-xl font-semibold mb-6 text-center">Contest Configuration</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">
                Number of problems (3-5)
              </label>
              <input 
                type="number" 
                min={3} 
                max={5} 
                value={num} 
                onChange={e=>setNum(e.target.value)} 
                className="w-full" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                Difficulty Level
              </label>
              <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="w-full">
                <option value="mixed">Mixed (Easy + Medium)</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-3">
                Topic (optional)
              </label>
              <select value={topic} onChange={e=>setTopic(e.target.value)} className="w-full">
                <option value="All">Any Topic</option>
                <option value="Array">Array</option>
                <option value="Linked List">Linked List</option>
                <option value="Tree">Tree</option>
                <option value="Graph">Graph</option>
                <option value="String">String</option>
                <option value="DP">Dynamic Programming</option>
                <option value="Stack/Queue">Stack/Queue</option>
                <option value="Matrix">Matrix</option>
                <option value="Hash / Map">Hash / Map</option>
                <option value="Binary Search">Binary Search</option>
                <option value="Two Pointers">Two Pointers</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-3">
                Duration (minutes)
              </label>
              <input 
                type="number" 
                min={10} 
                max={240} 
                value={durationMin} 
                onChange={e=>setDurationMin(e.target.value)} 
                className="w-full" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                Your Display Name
              </label>
              <input 
                type="text" 
                value={displayName} 
                onChange={e=>setDisplayName(e.target.value)} 
                placeholder="Enter your display name" 
                className="w-full" 
              />
              {!displayName && (
                <div className="text-sm text-red-500 mt-2">
                  Please enter your name — it will be shown on the leaderboard
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <button 
              onClick={create} 
              disabled={loading || !displayName} 
              className="w-full btn-accent wide flex items-center justify-center gap-3 text-lg font-semibold py-4"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Creating Contest...
                </>
              ) : (
                'Create & Get Link'
              )}
            </button>
          </div>


          {createdLink && (
            <div className="mt-6 p-4 card animate-slideIn" style={{background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)'}}>
              <div className="text-sm font-medium mb-3">
                Contest created successfully!
              </div>
              <div className="flex gap-3">
                <input 
                  className="flex-1 text-sm" 
                  value={createdLink} 
                  readOnly 
                />
                <button 
                  onClick={async ()=>{ 
                    await navigator.clipboard.writeText(createdLink); 
                    window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Link copied!', type:'success'}})) 
                  }} 
                  className="btn-secondary"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
        
        <Toast />
        {loading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
            <div className="card p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
              <div className="relative">
                <div className="animate-spin h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-6 w-6 bg-blue-600 rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold mb-1">Preparing your contest</div>
                <div className="text-sm text-muted">Selecting the best problems for you...</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}