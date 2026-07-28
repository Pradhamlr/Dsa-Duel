import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Timer from '../components/Timer'
import CodeEditor from '../components/CodeEditor'
import { authFetch, API, clearAuthSession, getStoredUserId, updateProfile, verifyLeetCodeSubmission, getContestEventsUrl } from '../utils/api'

const DIFFICULTY_STYLES = {
  Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hard: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
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
  background: disabled ? '#475569' : 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
  color: '#ffffff',
  fontWeight: 600,
  border: 'none',
  boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1
})

const neutralBtnStyle = {
  backgroundColor: '#1e293b',
  color: '#cbd5e1',
  border: '1px solid #334155',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease'
}

const neutralHoverProps = {
  onMouseEnter: (e) => { e.currentTarget.style.backgroundColor = '#293548'; e.currentTarget.style.borderColor = '#475569' },
  onMouseLeave: (e) => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.borderColor = '#334155' }
}

const successBtnStyle = {
  backgroundColor: 'rgba(16,185,129,0.12)',
  color: '#34d399',
  border: '1px solid rgba(16,185,129,0.35)',
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
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem('duel_name') || '' } catch { return '' }
  })
  const [leetcodeUsername, setLeetcodeUsername] = useState('')
  const [verifyingIndex, setVerifyingIndex] = useState(null)
  const [editorProblemIndex, setEditorProblemIndex] = useState(null)
  const [roster, setRoster] = useState([])
  const isFirstContestEventRef = useRef(true)
  const prevStartTimeRef = useRef(null)
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
        // Only apply this if nothing newer has arrived yet. StrictMode's dev-mode
        // double-invoke fires this effect twice with no fetch cancellation, and even
        // outside that, this GET can simply be slow -- if it resolves after the SSE
        // 'contest' push or a manual start/mark refetch already set real state, it must
        // not silently revert the UI back to a stale pre-update snapshot.
        setContest(prev => prev ? prev : data)
      } catch (err) {
        console.error('load error', err)
        window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: 'Failed to load contest', type:'error'}}))
      } finally {
        setLoading(false)
      }
    }
    load()
  },[id])

  // Live contest state (solves, start time, who's watching) over Server-Sent Events --
  // replaces polling entirely. Opening this connection IS the presence signal: the
  // server registers this user into the contest's roster the moment it connects, and
  // removes them on disconnect, so there's no separate join call to make.
  useEffect(()=>{
    if (!id) return
    const es = new EventSource(getContestEventsUrl(id))

    es.addEventListener('contest', (event) => {
      const data = JSON.parse(event.data)
      if (!isFirstContestEventRef.current && !prevStartTimeRef.current && data.startTime) {
        window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Contest started', type:'info'}}))
      }
      isFirstContestEventRef.current = false
      prevStartTimeRef.current = data.startTime
      setContest(data)
    })

    es.addEventListener('roster', (event) => {
      setRoster(JSON.parse(event.data))
    })

    return () => es.close()
  }, [id])

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

  function getStandingsRows(){
    if (!contest) return []
    const rows = []
    const results = contest.results || {}
    for (const uid of Object.keys(results)){
      const solvedMap = results[uid].solved || {}
      const solvedCount = Object.keys(solvedMap).filter(k => solvedMap[k]).length
      rows.push({ userId: uid, name: results[uid].name || null, solvedCount })
    }
    rows.sort((a,b)=> b.solvedCount - a.solvedCount || (a.name||a.userId).localeCompare(b.name||b.userId))
    return rows
  }

  async function copyResults(){
    const rows = getStandingsRows()
    const total = contest.problems?.length || 0
    const lines = [`Contest ${id} -- Results`, ...rows.map((r, i) => `${i+1}. ${r.name || r.userId} -- ${r.solvedCount}/${total}`)]
    await navigator.clipboard.writeText(lines.join('\n'))
    window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Results copied!', type:'success'}}))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-indigo-950/20 to-purple-950/10">
        <div className="bg-gray-900 rounded-2xl p-10 shadow-sm border border-white/10 flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-900 border-t-indigo-500 rounded-full"></div>
          <div className="text-gray-400 font-medium">Loading contest...</div>
        </div>
      </div>
    )
  }

  if (!contest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-indigo-950/20 to-purple-950/10 p-6">
        <div className="bg-gray-900 rounded-2xl p-10 shadow-sm border border-white/10 text-center max-w-sm">
          <div className="text-xl font-semibold text-gray-100 mb-2">Contest not found</div>
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

  // derive problem types using simple heuristics on title/slug
  function getProblemType(p) {
    if (p.finalTags && p.finalTags.length > 0) {
      return p.finalTags
    }
    return ['Other']
  }

  const problemTags = contest.problems.map(getProblemType)

  // Solve-count standings, kept fresh via the SSE subscription above and shown for the
  // full lifetime of the contest page -- during an active contest and after it ends,
  // since a separate post-contest "Final Results" view would just be the same data.
  function renderLiveStandings(){
    const rows = getStandingsRows()
    if (rows.length === 0) return null

    return (
      <div className="bg-gray-900 rounded-2xl p-6 shadow-sm border border-white/10 mb-6 animate-slideIn" style={{animationDelay: '0.08s'}}>
        <h2 className="text-sm font-semibold text-gray-100 mb-4">Live Standings</h2>
        <div className="space-y-2">
          {rows.map((r, idx) => {
            const isCurrentUser = r.userId === userId
            const isLeader = ended && idx === 0 && r.solvedCount > 0
            return (
              <div key={r.userId} className={`flex items-center justify-between px-4 py-2.5 rounded-xl transition-colors ${isLeader ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : isCurrentUser ? 'bg-indigo-500/10' : 'bg-gray-800/50'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-semibold w-5 flex-shrink-0 ${isLeader ? 'text-amber-400' : 'text-gray-500'}`}>#{idx+1}</span>
                  <span className="text-sm font-medium text-gray-200 truncate">{r.name || r.userId}{isCurrentUser ? ' (You)' : ''}</span>
                </div>
                <span className="text-sm font-semibold text-gray-100 flex-shrink-0">{r.solvedCount} / {contest.problems?.length || 0}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // A deliberate "you're done" moment instead of the page just sitting there once the
  // timer hits zero: names the winner (if anyone solved anything), and gives two clear
  // next actions -- a shareable results summary and a one-click path to a rematch.
  function renderContestEndedBanner(){
    if (!ended) return null
    const rows = getStandingsRows()
    const leader = rows[0]
    const hasWinner = leader && leader.solvedCount > 0

    return (
      <div className="rounded-2xl p-6 shadow-sm border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-purple-500/10 mb-6 animate-slideIn">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-100 mb-1">Contest Complete</div>
            <div className="text-sm text-gray-400">
              {hasWinner
                ? <><span className="font-medium text-amber-400">{leader.name || leader.userId}</span> won with {leader.solvedCount} / {contest.problems?.length || 0} solved</>
                : 'No one solved a problem this time -- worth a rematch?'}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={copyResults}
              className="px-4 py-2 text-sm rounded-xl"
              style={neutralBtnStyle}
              {...neutralHoverProps}
            >
              Copy Results
            </button>
            <button
              onClick={()=>navigate('/')}
              className="px-4 py-2 rounded-xl text-sm"
              style={primaryBtnStyle(false)}
            >
              Start a Rematch
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/20 to-purple-950/10 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Navbar */}
      <div className="relative z-20 flex justify-between items-center px-6 sm:px-8 py-6 bg-gray-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-gray-100 font-semibold text-xl tracking-tight">DSA DUEL</span>
          <span className="text-gray-600 hidden sm:inline">/</span>
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
          <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-white/10 mb-6 animate-slideIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text tracking-tight mb-1">
                  Contest {id}
                </h1>
                {contest.creatorName || contest.creatorId ? (
                  <div className="text-sm text-gray-500">
                    Created by <span className="font-medium text-gray-300">{contest.creatorName || contest.creatorId}</span>
                  </div>
                ) : null}
              </div>

              {contest.startTime ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2">
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
                    className="w-24 px-3 py-2 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                  />
                  {contest.creatorId && contest.creatorId !== userId ? (
                    <div className="text-sm text-gray-500 italic">
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

          {renderContestEndedBanner()}

          {/* Live Participants Panel */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-sm border border-white/10 mb-6 animate-slideIn" style={{animationDelay: '0.05s'}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Now
              </h2>
              <span className="text-xs text-gray-500">{roster.length} watching</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {roster.length === 0 ? (
                <div className="text-sm text-gray-500">Connecting...</div>
              ) : (
                roster.map((r) => {
                  const isCurrentUser = r.userId === userId
                  const label = r.name || r.userId
                  return (
                    <div
                      key={r.userId}
                      className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm ${isCurrentUser ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-300'}`}
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {label.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[140px]">{label}{isCurrentUser ? ' (You)' : ''}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* User Info Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-sm border border-white/10 mb-6 animate-slideIn" style={{animationDelay: '0.1s'}}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-5">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Your Display Name
                </label>
                <input
                  value={displayName}
                  onChange={e=>setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="w-full sm:w-72 px-4 py-2.5 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 backdrop-blur-sm text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-gray-600"
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
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Your LeetCode Username
                </label>
                <input
                  value={leetcodeUsername}
                  onChange={e=>setLeetcodeUsername(e.target.value)}
                  placeholder="e.g. john_doe123"
                  className="w-full sm:w-72 px-4 py-2.5 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 backdrop-blur-sm text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-gray-600"
                />
                <div className="text-xs text-gray-600 mt-1.5">
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

          <div>
              {renderLiveStandings()}

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-100">
                  Problems
                </h2>
              </div>

              {!contest.startTime && contest.problems.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl p-8 shadow-sm border border-white/10 text-center animate-slideIn">
                  <div className="text-lg font-semibold text-gray-100 mb-2">Problems will be revealed when the contest starts</div>
                  <div className="text-sm text-gray-500">
                    Selection happens at Start, not now -- it can steer around problems anyone currently in the room has recently solved or attempted.
                  </div>
                </div>
              ) : (
              <div className="grid gap-4">
                {contest.problems.map((p, i) => {
                  const solved = contest.results && contest.results[userId] && contest.results[userId].solved && contest.results[userId].solved[i]
                  const difficultyLabel = p.difficulty || 'Medium'
                  const difficultyStyle = DIFFICULTY_STYLES[difficultyLabel] || DIFFICULTY_STYLES.Medium

                  return (
                    <div
                      key={i}
                      className={`bg-gray-900 rounded-2xl p-6 shadow-sm border transition-all duration-300 animate-slideIn ${solved ? 'border-emerald-500/30' : 'border-white/10 hover:shadow-md hover:border-white/20'}`}
                      style={{animationDelay: `${0.05 * (i + 1)}s`}}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {i+1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg text-gray-100 mb-2 truncate">{p.title}</h3>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${difficultyStyle}`}>
                                  {difficultyLabel}
                                </span>
                                {problemTags[i].map((tag) => (
                                  <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-800 text-gray-400">
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
                            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                          >
                            Open on LeetCode <ArrowUpRightSVG />
                          </a>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {contest.startTime && !ended ? (
                            <>
                              <button
                                onClick={()=>setEditorProblemIndex(i)}
                                className="px-4 py-2 rounded-xl text-sm"
                                style={neutralBtnStyle}
                                {...neutralHoverProps}
                              >
                                View Problem
                              </button>
                              {solved ? (
                                <button
                                  onClick={()=>mark(i, false)}
                                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl"
                                  style={successBtnStyle}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.18)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.12)' }}
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
                            <div className="text-sm text-gray-500 italic">
                              {!contest.startTime ? 'Contest not started' : 'Contest ended'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              )}
            </div>
        </div>
      </div>

      {editorProblemIndex !== null && (
        <CodeEditor
          problem={contest.problems[editorProblemIndex]}
          contestId={id}
          problemIndex={editorProblemIndex}
          onClose={() => setEditorProblemIndex(null)}
          onSolved={(updatedContest) => setContest(updatedContest)}
        />
      )}
    </div>
  )
}
