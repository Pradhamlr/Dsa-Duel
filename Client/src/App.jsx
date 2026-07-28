import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Contest from './pages/Contest'
import Landing from './pages/Landing'
import Auth from './components/Auth'
import ForgotPassword from './components/ForgotPassword'
import EmailVerification from './components/EmailVerification'
import { ToastProvider } from './contexts/ToastContext'
import { clearAuthSession, storeAuthSession, consumePendingSessionMessage } from './utils/api'

export default function App(){
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showEmailVerification, setShowEmailVerification] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [authMode, setAuthMode] = useState('login')

  // Stash a deep-link destination (e.g. a shared /contest/:id link opened while logged
  // out) before anything else touches the URL. There's no Router at all in the !user
  // branch below, so a path like /contest/abc123 is otherwise only preserved by
  // coincidence -- and it's NOT preserved for Google OAuth, which does a real
  // cross-domain redirect back to the backend and returns to "/" with a token in the
  // hash, losing the original path entirely.
  useEffect(() => {
    const path = window.location.pathname + window.location.search
    if (path !== '/') {
      sessionStorage.setItem('duel_redirect_after_login', path)
    }
  }, [])

  // Restores the stashed destination in the address bar. Must run SYNCHRONOUSLY right
  // before the setUser(...) call that flips the render from the !user branch (no
  // Router at all) to <BrowserRouter>, not in a useEffect -- BrowserRouter reads
  // window.location once at its own first render, and a plain history.replaceState
  // called afterward (e.g. from a useEffect, which fires after commit) doesn't make an
  // already-mounted Router re-evaluate; React Router only reacts to its own
  // navigate()/popstate, not external history mutations.
  const restoreRedirectDestination = () => {
    const redirectTo = sessionStorage.getItem('duel_redirect_after_login')
    sessionStorage.removeItem('duel_redirect_after_login')
    return redirectTo
  }

  // Check for existing authentication
  useEffect(() => {
    const verifyUser = async () => {
      if (window.location.hash) {
        const params = new URLSearchParams(window.location.hash.slice(1))
        const accessToken = params.get('accessToken')
        const rawUser = params.get('user')

        if (accessToken && rawUser) {
          try {
            const oauthUser = JSON.parse(rawUser)
            storeAuthSession({ accessToken, user: oauthUser })
            const redirectTo = restoreRedirectDestination()
            window.history.replaceState(null, '', redirectTo || window.location.pathname || '/')
            setUser(oauthUser)
            setLoading(false)
            return
          } catch {
            clearAuthSession()
          }
        }
      }

      const oauthError = new URLSearchParams(window.location.search).get('oauthError')
      if (oauthError) {
        window.history.replaceState(null, '', window.location.pathname || '/')
      }

      const token = localStorage.getItem('duel_access_token')
      const userData = localStorage.getItem('duel_user')
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData)
          
          // Verify user still exists in database
          try {
            const response = await fetch(
              `${import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'}/auth/me`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }
            )
            
            if (response.ok) {
              const redirectTo = restoreRedirectDestination()
              if (redirectTo) window.history.replaceState(null, '', redirectTo)
              setUser(parsedUser)
            } else {
              // User deleted or token invalid - clear everything
              clearAuthSession()
              setUser(null)
            }
          } catch (verifyError) {
            // Network error during verification - use cached user for now
            const redirectTo = restoreRedirectDestination()
            if (redirectTo) window.history.replaceState(null, '', redirectTo)
            setUser(parsedUser)
          }
        } catch (parseError) {
          clearAuthSession()
        }
      }
      setLoading(false)
    }
    
    verifyUser()
  }, [])

  // Initialize theme on app load
  useEffect(() => {
    // Force light theme only
    document.documentElement.classList.remove('dark')
  }, [])

  // Surface a one-time message if authFetch forced a reload due to detected
  // refresh-token reuse (see utils/api.js consumePendingSessionMessage).
  useEffect(() => {
    const message = consumePendingSessionMessage()
    if (message) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type: 'warning' } }))
    }
  }, [])

  const handleAuthSuccess = (userData) => {
    if (userData.needsVerification) {
      setVerificationEmail(userData.email)
      setShowAuth(false)
      setShowEmailVerification(true)
    } else {
      const redirectTo = restoreRedirectDestination()
      if (redirectTo) window.history.replaceState(null, '', redirectTo)
      setUser(userData)
    }
  }

  const handleVerificationSuccess = (userData) => {
    const redirectTo = restoreRedirectDestination()
    if (redirectTo) window.history.replaceState(null, '', redirectTo)
    setUser(userData)
  }

  const handleLogout = () => {
    clearAuthSession()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
      </div>
    )
  }

  const handleNavigate = (mode) => {
    setAuthMode(mode)
    setShowAuth(true)
  }

  const handleBackToLanding = () => {
    setShowAuth(false)
    setShowForgotPassword(false)
    setShowEmailVerification(false)
  }

  const handleForgotPassword = () => {
    setShowAuth(false)
    setShowForgotPassword(true)
  }

  const handleBackToLogin = () => {
    setShowForgotPassword(false)
    setShowEmailVerification(false)
    setShowAuth(true)
    setAuthMode('login')
  }

  if (!user) {
    if (showEmailVerification) {
      return (
        <ToastProvider>
          <EmailVerification
            email={verificationEmail}
            onVerificationSuccess={handleVerificationSuccess}
            onBack={handleBackToLogin}
          />
        </ToastProvider>
      )
    }
    if (showForgotPassword) {
      return (
        <ToastProvider>
          <ForgotPassword 
            onBack={handleBackToLanding}
            onLoginRedirect={handleBackToLogin}
          />
        </ToastProvider>
      )
    }
    if (showAuth) {
      return (
        <ToastProvider>
          <Auth 
            onAuthSuccess={handleAuthSuccess} 
            initialMode={authMode}
            onBack={handleBackToLanding}
            onForgotPassword={handleForgotPassword}
          />
        </ToastProvider>
      )
    }
    return <Landing onNavigate={handleNavigate} />
  }

  return (
    <ToastProvider>
      <div className="min-h-screen transition-colors duration-300">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home/>} />
            <Route path="/contest/:id" element={<Contest/>} />
          </Routes>
        </BrowserRouter>
      </div>
    </ToastProvider>
  )
}
