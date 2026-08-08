const API = import.meta.env.VITE_API_BASE || 'https://api.pradhamlr.me'

export const clearAuthSession = () => {
  localStorage.removeItem('duel_access_token')
  localStorage.removeItem('duel_refresh_token')
  localStorage.removeItem('duel_user')
  localStorage.removeItem('duel_userId')
  localStorage.removeItem('duel_name')
  localStorage.removeItem('duel_token')
}

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('duel_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const getStoredUserId = () => {
  const user = getStoredUser()
  return user?.id || localStorage.getItem('duel_userId') || ''
}

export const storeAuthSession = ({ accessToken, user }) => {
  localStorage.setItem('duel_access_token', accessToken)
  localStorage.setItem('duel_user', JSON.stringify(user))
  localStorage.setItem('duel_userId', user.id)
  localStorage.setItem('duel_name', user.name || '')
}

// Helper function to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('duel_access_token')
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }
}

// Refresh access token
const refreshAccessToken = async () => {
  try {
    const response = await fetch(`${API}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    })

    if (response.ok) {
      const data = await response.json()
      localStorage.setItem('duel_access_token', data.accessToken)
      return { ok: true }
    }

    const data = await response.json().catch(() => ({}))
    return { ok: false, code: data.code }
  } catch (error) {
    console.error('Token refresh failed:', error)
    return { ok: false }
  }
}

const SESSION_MESSAGE_KEY = 'duel_session_message'

// Authenticated fetch wrapper
export const authFetch = async (url, options = {}) => {
  let response = await fetch(`${API}${url}`, {
    ...options,
    credentials: options.credentials || 'include',
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  })

  if (response.status === 401) {
    // Try to refresh token
    const refreshResult = await refreshAccessToken()

    if (refreshResult.ok) {
      // Retry with new token
      response = await fetch(`${API}${url}`, {
        ...options,
        credentials: options.credentials || 'include',
        headers: {
          ...getAuthHeaders(),
          ...options.headers
        }
      })
    } else {
      // Refresh failed, clear tokens and reload
      clearAuthSession()
      if (refreshResult.code === 'SESSION_REVOKED') {
        sessionStorage.setItem(
          SESSION_MESSAGE_KEY,
          'You were signed out because reuse of an old session token was detected. All devices were signed out for your safety.'
        )
      }
      window.location.reload()
      return
    }
  }

  return response
}

// Consumes (reads + clears) any pending session-security message left by authFetch,
// so the app can surface it once after the reload it triggers.
export const consumePendingSessionMessage = () => {
  const message = sessionStorage.getItem(SESSION_MESSAGE_KEY)
  if (message) sessionStorage.removeItem(SESSION_MESSAGE_KEY)
  return message
}

// Session (device) management
export const getSessions = async () => {
  const res = await authFetch('/auth/sessions')
  if (!res || !res.ok) throw new Error('Failed to load sessions')
  const data = await res.json()
  return data.sessions
}

export const revokeSession = async (sessionId) => {
  const res = await authFetch(`/auth/sessions/${sessionId}`, { method: 'DELETE' })
  if (!res || !res.ok) {
    const data = await res?.json().catch(() => ({}))
    throw new Error(data?.error || 'Failed to revoke session')
  }
}

export const revokeOtherSessions = async () => {
  const res = await authFetch('/auth/sessions/other', { method: 'DELETE' })
  if (!res || !res.ok) throw new Error('Failed to sign out other devices')
}

// Profile updates (display name, LeetCode username)
export const updateProfile = async ({ name, leetcodeUsername }) => {
  const res = await authFetch('/', {
    method: 'POST',
    body: JSON.stringify({
      ...(name !== undefined ? { name } : {}),
      ...(leetcodeUsername !== undefined ? { leetcodeUsername } : {})
    })
  })
  if (!res || !res.ok) {
    const data = await res?.json().catch(() => ({}))
    throw new Error(data?.error || 'Failed to update profile')
  }
  return res.json()
}

// Revision tab: every problem this user has ever attempted/solved, across all contests
export const getSolvedProblems = async () => {
  const res = await authFetch('/problems/solved')
  const data = await res?.json().catch(() => ({}))
  if (!res || !res.ok) {
    throw new Error(data?.error || 'Failed to load your problem history')
  }
  return data.rows
}

// Aggregated progress stats (solved/attempting counts per difficulty + catalog totals)
// for the solve ring. Already aggregated server-side -- no counting needed here.
export const getProblemStats = async () => {
  const res = await authFetch('/problems/stats')
  const data = await res?.json().catch(() => ({}))
  if (!res || !res.ok) {
    throw new Error(data?.error || 'Failed to load your progress stats')
  }
  return data
}

// Solve streak, per-topic strength, and an 84-day daily activity history for the
// revision tab's analytics section. Already aggregated server-side.
export const getAnalytics = async () => {
  const res = await authFetch('/problems/analytics')
  const data = await res?.json().catch(() => ({}))
  if (!res || !res.ok) {
    throw new Error(data?.error || 'Failed to load your analytics')
  }
  return data
}

// Scoped server-side to the caller's own history -- irreversible, UI must confirm first
export const clearSolvedProblems = async () => {
  const res = await authFetch('/problems/solved', { method: 'DELETE' })
  if (!res || !res.ok) {
    const data = await res?.json().catch(() => ({}))
    throw new Error(data?.error || 'Failed to clear your progress')
  }
  return res.json()
}

// EventSource can't set custom headers, so the access token travels as a query param
// instead (verified server-side by sseAuthMiddleware the same way the Authorization
// header is elsewhere). Live contest updates + the connected-participants roster.
export const getContestEventsUrl = (contestId) => {
  const token = localStorage.getItem('duel_access_token')
  return `${API}/contest/${contestId}/events?token=${encodeURIComponent(token || '')}`
}

// Full problem details (description + example test cases) for the LeetCode-style view.
// Not auth-gated on the backend, but authFetch works fine unauthenticated too.
export const getProblemDetails = async (contestId, problemIndex) => {
  const res = await authFetch(`/contest/${contestId}/problem/${problemIndex}`)
  const data = await res?.json().catch(() => ({}))
  if (!res || !res.ok) {
    throw new Error(data?.error || 'Failed to load problem details')
  }
  return data
}

// Verify a contest problem as solved via the user's real LeetCode submission history
export const verifyLeetCodeSubmission = async (contestId, problemIndex) => {
  const res = await authFetch(`/contest/${contestId}/verify-leetcode`, {
    method: 'POST',
    body: JSON.stringify({ problemIndex })
  })
  const data = await res?.json().catch(() => ({}))
  if (!res || !res.ok) {
    throw new Error(data?.error || 'Failed to verify LeetCode submission')
  }
  return data
}

// In-app judge: run (no scoring) or submit (scores + marks solved on a full pass)
export const runCode = async (contestId, problemIndex, language, code) => {
  const res = await authFetch(`/contest/${contestId}/run`, {
    method: 'POST',
    body: JSON.stringify({ problemIndex, language, code })
  })
  const data = await res?.json().catch(() => ({}))
  if (!res || !res.ok) {
    throw new Error(data?.error || 'Failed to run code')
  }
  return data
}

export const submitCode = async (contestId, problemIndex, language, code) => {
  const res = await authFetch(`/contest/${contestId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ problemIndex, language, code })
  })
  const data = await res?.json().catch(() => ({}))
  if (!res || !res.ok) {
    throw new Error(data?.error || 'Failed to submit code')
  }
  return data
}

// Auto-generated edge cases (empty, single-element, negative, large inputs) -- a
// crash/timeout confidence check, not a correctness verification. Never scores or
// marks solved, so unlike submitCode this never returns an updated contest.
export const stressTest = async (contestId, problemIndex, language, code) => {
  const res = await authFetch(`/contest/${contestId}/stress-test`, {
    method: 'POST',
    body: JSON.stringify({ problemIndex, language, code })
  })
  const data = await res?.json().catch(() => ({}))
  if (!res || !res.ok) {
    throw new Error(data?.error || 'Failed to run stress test')
  }
  return data
}

export const logout = async () => {
  try {
    await authFetch('/auth/logout', { method: 'POST' })
  } catch (error) {
    console.error('Logout request failed:', error)
  } finally {
    clearAuthSession()
  }
}

export { API }
