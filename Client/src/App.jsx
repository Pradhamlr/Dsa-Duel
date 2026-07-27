import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Contest from './pages/Contest'
import Leaderboard from './pages/Leaderboard'
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
            window.history.replaceState(null, '', window.location.pathname || '/')
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
              setUser(parsedUser)
            } else {
              // User deleted or token invalid - clear everything
              clearAuthSession()
              setUser(null)
            }
          } catch (verifyError) {
            // Network error during verification - use cached user for now
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
      setUser(userData)
    }
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
            onVerificationSuccess={setUser}
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
            <Route path="/leaderboard" element={<Leaderboard/>} />
          </Routes>
        </BrowserRouter>
      </div>
    </ToastProvider>
  )
}
