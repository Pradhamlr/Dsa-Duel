import React, { useEffect, useState } from 'react'
import { getSessions, revokeSession, revokeOtherSessions } from '../utils/api'

const formatRelative = (isoString) => {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function Sessions({ onClose }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await getSessions()
      setSessions(data)
    } catch (err) {
      setError(err.message || 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleRevoke = async (sessionId) => {
    try {
      setBusyId(sessionId)
      await revokeSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Device signed out', type: 'success' } }))
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message, type: 'error' } }))
    } finally {
      setBusyId(null)
    }
  }

  const handleRevokeOthers = async () => {
    try {
      setBusyId('all')
      await revokeOtherSessions()
      await load()
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Signed out of all other devices', type: 'success' } }))
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: err.message, type: 'error' } }))
    } finally {
      setBusyId(null)
    }
  }

  const otherCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Active sessions</h2>
            <p className="text-sm text-gray-500">Devices currently signed in to your account</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="py-8 text-center text-sm text-gray-500">Loading sessions...</div>
          )}

          {!loading && error && (
            <div className="py-8 text-center text-sm text-red-500">{error}</div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">No active sessions</div>
          )}

          {!loading && !error && sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
            >
              <div>
                <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  {session.deviceLabel || 'Unknown device'}
                  {session.isCurrent && (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      This device
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Last active {formatRelative(session.lastUsedAt)}
                  {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                </div>
              </div>
              {!session.isCurrent && (
                <button
                  onClick={() => handleRevoke(session.id)}
                  disabled={busyId === session.id}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {busyId === session.id ? 'Signing out...' : 'Sign out'}
                </button>
              )}
            </div>
          ))}
        </div>

        {!loading && !error && otherCount > 0 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <button
              onClick={handleRevokeOthers}
              disabled={busyId === 'all'}
              className="w-full text-sm font-semibold text-white bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-2.5 transition-colors"
            >
              {busyId === 'all' ? 'Signing out...' : `Sign out ${otherCount} other device${otherCount > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
