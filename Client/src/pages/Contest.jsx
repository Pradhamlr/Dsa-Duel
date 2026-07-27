import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Timer from '../components/Timer'
import CodeEditor from '../components/CodeEditor'
import { authFetch, API, clearAuthSession, getStoredUserId, updateProfile, verifyLeetCodeSubmission } from '../utils/api'

const DIFFICULTY_STYLES = {
  Easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Hard: 'bg-rose-50 text-rose-700 border-rose-200'
}

const CheckSVG = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ArrowUpRightSVG = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// App.css has a global `button:not(.btn-primary):not(...)` rule with far higher CSS
// specificity than a single Tailwind utility class, which silently overrides any plain
// Tailwind-styled button's background/color. Inline styles are the only thing that
// reliably beats it (same reason Home.jsx/Auth.jsx use inline styles for their buttons
// instead of bg-black/bg-white classes) -- so every custom button color here is inline.
const primaryBtnStyle = (disabled) => ({
  backgroundColor: disabled ? '#666666' : '#000000',
  color: '#ffffff',
  fontWeight: 600,
  border: 'none',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1
})

const neutralBtnStyle = {
  backgroundColor: '#f8fafc',
  color: '#374151',
  border: '1px solid #d1d5db',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease'
}

const neutralHoverProps = {
  onMouseEnter: (e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#9ca3af' },
  onMouseLeave: (e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#d1d5db' }
}

const successBtnStyle = {
  backgroundColor: '#ecfdf5',
  color: '#047857',
  border: '1px solid #a7f3d0',
  fontWeight: 600,
  cursor: 'pointer'
}

export default function Contest(){
  const { id } = useParams()
  const [contest, setContest] = useState(null)
  const [userId, setUserId] = useState(() => getStoredUserId())
  const [loading, setLoading] = useState(true)
  const [ended, setEnded] = useState(false)
  const [durationOverrideMin, setDurationOverrideMin] = useState('')
  const [selectedSort, setSelectedSort] = useState('solved-desc')
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem('duel_name') || '' } catch { return '' }
  })
  const [leetcodeUsername, setLeetcodeUsername] = useState('')
  const [verifyingIndex, setVerifyingIndex] = useState(null)
  const [editorProblemIndex, setEditorProblemIndex] = useState(null)
  const navigate = useNavigate()

  // Verify user exists on mount
  useEffect(() => {
    const verifyUserExists = async () => {
      try {
        const token = localStorage.getItem('duel_access_token')
        if (!token) {
          navigate('/')
          return
        }

        const response = await authFetch('/auth/me')
        if (!response.ok) {
          // User doesn't exist - clear data and redirect home
          clearAuthSession()
          navigate('/')
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Your account was deleted. Please log in again.', type: 'error' } }))
          return
        }

        const data = await response.json()
        if (data?.user?.id) {
          setUserId(data.user.id)
          localStorage.setItem('duel_userId', data.user.id)
          localStorage.setItem('duel_user', JSON.stringify(data.user))
          setLeetcodeUsername(data.user.leetcodeUsername || '')
        }
      } catch (error) {
        console.error('User verification error:', error)
      }
    }

    verifyUserExists()
  }, [navigate])

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

  async function startWithBody(body){
    try {
      const res = await authFetch(`/contest/${id}/start`, { method: 'POST', body: JSON.stringify(body) })
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
    if (!userId) {
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: 'Please log in again before marking problems', type:'error'}}))
      return
    }

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
      const res = await authFetch(`/contest/${id}/mark`, { method: 'POST', body: JSON.stringify({ problemIndex: idx, solved }) })
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
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Name updated locally', type:'success'}}))
    } catch (e) {
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Failed to save name', type:'error'}}))
    }
  }

  async function saveLeetcodeUsername(){
    try {
      await updateProfile({ leetcodeUsername: leetcodeUsername.trim() })
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'LeetCode username saved', type:'success'}}))
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: err.message || 'Failed to save LeetCode username', type:'error'}}))
    }
  }

  async function verifyOnLeetcode(idx){
    setVerifyingIndex(idx)
    try {
      const data = await verifyLeetCodeSubmission(id, idx)
      if (data.verified) {
        setContest(data.contest)
        window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Verified via LeetCode!', type:'success'}}))
      } else {
        window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: data.message || 'Not verified yet', type:'warning'}}))
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: err.message || 'Verification failed', type:'error'}}))
    } finally {
      setVerifyingIndex(null)
    }
  }

  async function copyLink(){
    await navigator.clipboard.writeText(`${window.location.origin}/contest/${id}`)
    window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Link copied!', type:'success'}}))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50/30 via-white to-indigo-50/20">
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-black/6 flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full"></div>
          <div className="text-gray-600 font-medium">Loading contest...</div>
        </div>
      </div>
    )
  }

  if (!contest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50/30 via-white to-indigo-50/20 p-6">
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-black/6 text-center max-w-sm">
          <div className="text-xl font-semibold text-gray-900 mb-2">Contest not found</div>
          <div className="text-gray-500 mb-6 text-sm">The contest you're looking for doesn't exist or has been removed.</div>
          <button
            onClick={()=>navigate('/')}
            className="px-6 py-2.5 rounded-xl transition-colors"
            style={primaryBtnStyle(false)}
          >
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
  function getProblemType(p) {
    if (p.finalTags && p.finalTags.length > 0) {
      return p.finalTags
    }
    return ['Other']
  }

  const problemTags = contest.problems.map(getProblemType)

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
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-black/6 text-center">
          <div className="text-lg font-semibold text-gray-900 mb-2">No results yet</div>
          <div className="text-sm text-gray-500">Results will appear here once participants start solving problems</div>
        </div>
      )
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Final Results</h2>
          <select
            value={selectedSort}
            onChange={e=>setSelectedSort(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          >
            <option value="solved-desc">Most Solved</option>
            <option value="solved-asc">Least Solved</option>
            <option value="name-asc">Name A-Z</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-black/6 overflow-hidden">
          <div style={{display: 'grid', gridTemplateColumns: '60px 1fr 80px'}} className="gap-4 px-5 py-3 font-semibold text-xs uppercase tracking-wide text-gray-400 border-b border-black/6">
            <div>Rank</div>
            <div>Participant</div>
            <div className="text-right">Solved</div>
          </div>

          <div className="divide-y divide-gray-100">
            {rows.map((r, idx) => {
              const isCurrentUser = r.userId === userId

              return (
                <div
                  key={r.userId}
                  style={{display: 'grid', gridTemplateColumns: '60px 1fr 80px'}}
                  className={`gap-4 px-5 py-4 items-center ${isCurrentUser ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className="font-semibold text-gray-700">
                    #{idx+1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 flex items-center gap-2 truncate">
                      {r.name || r.userId}
                      {isCurrentUser && (
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full flex-shrink-0">You</span>
                      )}
                    </div>
                    {r.name && <div className="text-xs text-gray-400 truncate">{r.userId}</div>}
                  </div>
                  <div className="text-right font-semibold text-gray-900">
                    {r.solvedCount} / {contest.problems?.length || 0}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-indigo-50/20 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-indigo-100/20 to-purple-100/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-100/20 to-indigo-100/20 rounded-full blur-3xl"></div>
      </div>

      {/* Navbar */}
      <div className="relative z-20 flex justify-between items-center px-6 sm:px-8 py-6 bg-white/80 backdrop-blur-xl border-b border-black/6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-gray-900 font-semibold text-xl tracking-tight">DSA DUEL</span>
          <span className="text-gray-300 hidden sm:inline">/</span>
          <span className="text-gray-500 font-medium hidden sm:inline">Contest {id}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={copyLink}
            className="px-3 py-1.5 text-sm rounded-lg"
            style={neutralBtnStyle}
            {...neutralHoverProps}
          >
            Copy Link
          </button>
          <button
            onClick={()=>navigate('/')}
            className="px-3 py-1.5 text-sm rounded-lg"
            style={neutralBtnStyle}
            {...neutralHoverProps}
          >
            Home
          </button>
        </div>
      </div>

      <div className="relative z-10 p-4 sm:p-8 flex justify-center animate-fadeIn">
        <div className="w-full max-w-4xl">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-black/6 mb-6 animate-slideIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text tracking-tight mb-1">
                  Contest {id}
                </h1>
                {contest.creatorName || contest.creatorId ? (
                  <div className="text-sm text-gray-500">
                    Created by <span className="font-medium text-gray-700">{contest.creatorName || contest.creatorId}</span>
                  </div>
                ) : null}
              </div>

              {contest.startTime ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
                    <span className="text-xs font-medium text-gray-500">Time left</span>
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
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <input
                    type="number"
                    placeholder={`${Math.floor(contest.duration/60)} min`}
                    min={5}
                    max={480}
                    value={durationOverrideMin}
                    onChange={e=>setDurationOverrideMin(e.target.value)}
                    className="w-24 px-3 py-2 border border-gray-200 rounded-xl bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                  {contest.creatorId && contest.creatorId !== userId ? (
                    <div className="text-sm text-gray-400 italic">
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
                      className="px-6 py-2.5 rounded-xl transition-colors"
                      style={primaryBtnStyle(false)}
                    >
                      Start Contest
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* User Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/6 mb-6 animate-slideIn" style={{animationDelay: '0.1s'}}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-5">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  Your Display Name
                </label>
                <input
                  value={displayName}
                  onChange={e=>setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="w-full sm:w-72 px-4 py-2.5 border border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 hover:border-gray-300"
                />
              </div>
              <button
                onClick={saveName}
                className="px-4 py-2 text-sm rounded-xl"
                style={neutralBtnStyle}
                {...neutralHoverProps}
              >
                Save Name
              </button>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  Your LeetCode Username
                </label>
                <input
                  value={leetcodeUsername}
                  onChange={e=>setLeetcodeUsername(e.target.value)}
                  placeholder="e.g. john_doe123"
                  className="w-full sm:w-72 px-4 py-2.5 border border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 hover:border-gray-300"
                />
                <div className="text-xs text-gray-400 mt-1.5">
                  Needed to verify solves against your real LeetCode submissions. Your submission history must be public.
                </div>
              </div>
              <button
                onClick={saveLeetcodeUsername}
                className="px-4 py-2 text-sm rounded-xl"
                style={neutralBtnStyle}
                {...neutralHoverProps}
              >
                Save
              </button>
            </div>
          </div>

          {isOver ? (
            <div className="animate-slideIn" style={{animationDelay: '0.2s'}}>
              {renderLeaderboard()}
              <div className="mt-6 text-center">
                <button
                  onClick={()=>navigate('/')}
                  className="px-6 py-2.5 text-sm rounded-xl"
                  style={neutralBtnStyle}
                  {...neutralHoverProps}
                >
                  Back to Home
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Problems
                </h2>
              </div>

              <div className="grid gap-4">
                {contest.problems.map((p, i) => {
                  const solved = contest.results && contest.results[userId] && contest.results[userId].solved && contest.results[userId].solved[i]
                  const difficultyLabel = p.difficulty || 'Medium'
                  const difficultyStyle = DIFFICULTY_STYLES[difficultyLabel] || DIFFICULTY_STYLES.Medium

                  return (
                    <div
                      key={i}
                      className={`bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 animate-slideIn ${solved ? 'border-emerald-200' : 'border-black/6 hover:shadow-md hover:border-gray-200'}`}
                      style={{animationDelay: `${0.05 * (i + 1)}s`}}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {i+1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg text-gray-900 mb-2 truncate">{p.title}</h3>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${difficultyStyle}`}>
                                  {difficultyLabel}
                                </span>
                                {problemTags[i].map((tag) => (
                                  <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <a
                            href={`https://leetcode.com/problems/${p.slug}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                          >
                            Open on LeetCode <ArrowUpRightSVG />
                          </a>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {contest.startTime && !ended ? (
                            <>
                              {p.judgeSupported && (
                                <button
                                  onClick={()=>setEditorProblemIndex(i)}
                                  className="px-4 py-2 rounded-xl text-sm"
                                  style={neutralBtnStyle}
                                  {...neutralHoverProps}
                                >
                                  Solve in Editor
                                </button>
                              )}
                              {solved ? (
                                <button
                                  onClick={()=>mark(i, false)}
                                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl"
                                  style={successBtnStyle}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d1fae5' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ecfdf5' }}
                                >
                                  <CheckSVG /> Verified
                                </button>
                              ) : (
                                <button
                                  onClick={()=>verifyOnLeetcode(i)}
                                  disabled={verifyingIndex === i}
                                  className="px-4 py-2 rounded-xl text-sm"
                                  style={primaryBtnStyle(verifyingIndex === i)}
                                  title="Checks your real LeetCode submission history for this problem"
                                >
                                  {verifyingIndex === i ? 'Checking...' : 'Verify via LeetCode'}
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-gray-400 italic">
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
        </div>
      </div>

      {editorProblemIndex !== null && (
        <CodeEditor
          problem={contest.problems[editorProblemIndex]}
          onClose={() => setEditorProblemIndex(null)}
        />
      )}
    </div>
  )
}
