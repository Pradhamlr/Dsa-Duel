import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch, clearAuthSession, getSolvedProblems, getProblemStats, getAnalytics, clearSolvedProblems } from '../utils/api'
import SolveProgressRing from '../components/SolveProgressRing'
import AnalyticsPanel from '../components/AnalyticsPanel'

// A dot + colored word reads lighter than a bordered pill, and is what this section
// switched to (from a pill, matching DIFFICULTY_STYLES' old shape) once a real problem
// list showed how quickly several pills per card (difficulty + status + every tag)
// turns into visual noise -- LeetCode's own list uses plain colored text for exactly
// this reason.
const DIFFICULTY_DOT_COLORS = { Easy: '#34d399', Medium: '#fbbf24', Hard: '#fb7185' }
const DIFFICULTY_TEXT_STYLES = { Easy: 'text-emerald-400', Medium: 'text-amber-400', Hard: 'text-rose-400' }

const ArrowUpRightSVG = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const CheckCircleSVG = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const DashCircleSVG = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const formatRelative = (ms) => {
  const diffMs = Date.now() - ms
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

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

const dangerBtnStyle = {
  backgroundColor: 'rgba(244,63,94,0.12)',
  color: '#fb7185',
  border: '1px solid rgba(244,63,94,0.3)',
  fontWeight: 600,
  cursor: 'pointer'
}

export default function Revision() {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('duel_access_token')
    if (!token) {
      navigate('/')
      return
    }

    async function load() {
      try {
        const response = await authFetch('/auth/me')
        if (!response.ok) {
          clearAuthSession()
          navigate('/')
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Your account was deleted. Please log in again.', type: 'error' } }))
          return
        }
        // Fetched together rather than sequentially -- none of the three depends on
        // another, and this keeps the ring/analytics from popping in noticeably after
        // the list.
        const [data, statsData, analyticsData] = await Promise.all([getSolvedProblems(), getProblemStats(), getAnalytics()])
        setRows(data)
        setStats(statsData)
        setAnalytics(analyticsData)
      } catch (err) {
        console.error('load solved problems error', err)
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Failed to load your problem history', type: 'error' } }))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [navigate])

  async function handleClearProgress() {
    setClearing(true)
    try {
      await clearSolvedProblems()
      setRows([])
      // Zero the ring's own counters too -- catalog totals stay, only this user's
      // progress is cleared, so the ring should show an empty ring, not stale counts.
      setStats((prev) => prev && ({
        ...prev,
        solved: 0,
        attempting: 0,
        byDifficulty: Object.fromEntries(
          Object.entries(prev.byDifficulty).map(([k, v]) => [k, { ...v, solved: 0 }])
        )
      }))
      // Same reasoning as the ring above -- catalog-wide topic totals stay, only this
      // user's own streak/solve history resets.
      setAnalytics((prev) => prev && ({
        streak: { current: 0, longest: 0 },
        topicStrength: prev.topicStrength.map((t) => ({ ...t, solved: 0 })),
        history: prev.history.map((h) => ({ ...h, count: 0 }))
      }))
      setConfirmingClear(false)
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Progress cleared', type: 'success' } }))
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message || 'Failed to clear progress', type: 'error' } }))
    } finally {
      setClearing(false)
    }
  }

  const filteredRows = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  const solvedCount = rows.filter((r) => r.status === 'solved').length
  const attemptedCount = rows.filter((r) => r.status === 'attempted').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/20 to-purple-950/10 relative overflow-hidden">
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
          <span className="text-gray-500 font-medium hidden sm:inline">My Problems</span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-3 py-1.5 text-sm rounded-lg"
          style={neutralBtnStyle}
          {...neutralHoverProps}
        >
          Home
        </button>
      </div>

      <div className="relative z-10 p-4 sm:p-8 flex justify-center animate-fadeIn">
        <div className="w-full max-w-4xl">
          {/* Header Card */}
          <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-white/10 mb-6 animate-slideIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text tracking-tight mb-1">
                  My Problems
                </h1>
                <div className="text-sm text-gray-500">
                  {solvedCount} solved &middot; {attemptedCount} attempted, not yet solved
                </div>
              </div>

              {rows.length > 0 && (
                confirmingClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Clear all history? This can't be undone.</span>
                    <button
                      onClick={handleClearProgress}
                      disabled={clearing}
                      className="px-4 py-2 rounded-xl text-sm"
                      style={dangerBtnStyle}
                    >
                      {clearing ? 'Clearing...' : 'Yes, clear it'}
                    </button>
                    <button
                      onClick={() => setConfirmingClear(false)}
                      className="px-4 py-2 rounded-xl text-sm"
                      style={neutralBtnStyle}
                      {...neutralHoverProps}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingClear(true)}
                    className="px-4 py-2 rounded-xl text-sm"
                    style={neutralBtnStyle}
                    {...neutralHoverProps}
                  >
                    Clear My Progress
                  </button>
                )
              )}
            </div>
          </div>

          {!loading && stats && (
            <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-white/10 mb-6 animate-slideIn flex justify-center" style={{ animationDelay: '0.05s' }}>
              <SolveProgressRing stats={stats} />
            </div>
          )}

          {!loading && analytics && (
            <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-white/10 mb-6 animate-slideIn" style={{ animationDelay: '0.1s' }}>
              <AnalyticsPanel analytics={analytics} />
            </div>
          )}

          {loading ? (
            <div className="bg-gray-900 rounded-2xl p-12 shadow-sm border border-white/10 flex flex-col items-center gap-4">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-900 border-t-indigo-500 rounded-full"></div>
              <div className="text-gray-400 font-medium">Loading your problem history...</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl p-12 shadow-sm border border-white/10 text-center">
              <div className="text-lg font-semibold text-gray-100 mb-2">Nothing here yet</div>
              <div className="text-sm text-gray-500">Solve or attempt a problem in any contest and it'll show up here.</div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                {[
                  { key: 'all', label: `All (${rows.length})` },
                  { key: 'solved', label: `Solved (${solvedCount})` },
                  { key: 'attempted', label: `Attempted (${attemptedCount})` }
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className="px-4 py-1.5 rounded-lg text-sm"
                    style={filter === f.key
                      ? { background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)', color: '#ffffff', fontWeight: 600, border: 'none' }
                      : neutralBtnStyle}
                    {...(filter === f.key ? {} : neutralHoverProps)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3">
                {filteredRows.map((r) => {
                  const dotColor = DIFFICULTY_DOT_COLORS[r.difficulty] || DIFFICULTY_DOT_COLORS.Medium
                  const difficultyTextStyle = DIFFICULTY_TEXT_STYLES[r.difficulty] || DIFFICULTY_TEXT_STYLES.Medium
                  const isSolved = r.status === 'solved'
                  return (
                    <div
                      key={r.slug}
                      className="bg-gray-900 rounded-2xl p-5 shadow-sm border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-semibold text-gray-100 truncate">{r.title}</h3>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium flex-shrink-0 ${isSolved ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isSolved ? <CheckCircleSVG /> : <DashCircleSVG />}
                            {isSolved ? 'Solved' : 'Attempted'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} aria-hidden />
                          <span className={`font-medium flex-shrink-0 ${difficultyTextStyle}`}>{r.difficulty}</span>
                          {(r.finalTags || []).length > 0 && (
                            <span className="truncate">&middot; {r.finalTags.join(' · ')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="text-xs text-gray-600">{formatRelative(r.lastInteractionAt)}</span>
                        <a
                          href={`https://leetcode.com/problems/${r.slug}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                        >
                          Open on LeetCode <ArrowUpRightSVG />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
