import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Contest from './pages/Contest'
import Leaderboard from './pages/Leaderboard'
import Landing from './pages/Landing'
import Auth from './components/Auth'
import ForgotPassword from './components/ForgotPassword'

export default function App(){
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [authMode, setAuthMode] = useState('login')

  // Check for existing authentication
  useEffect(() => {
    const token = localStorage.getItem('duel_token')
    const userData = localStorage.getItem('duel_user')
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData))
      } catch (e) {
        localStorage.removeItem('duel_token')
        localStorage.removeItem('duel_user')
      }
    }
    setLoading(false)
  }, [])

  // Initialize theme on app load
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('duel_dark')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const shouldUseDark = savedTheme === '1' || (savedTheme === null && prefersDark)
      
      if (shouldUseDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    } catch (e) {
      // Fallback to light theme if localStorage is not available
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const handleAuthSuccess = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('duel_token')
    localStorage.removeItem('duel_user')
    localStorage.removeItem('duel_userId')
    localStorage.removeItem('duel_name')
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
  }

  const handleForgotPassword = () => {
    setShowAuth(false)
    setShowForgotPassword(true)
  }

  const handleBackToLogin = () => {
    setShowForgotPassword(false)
    setShowAuth(true)
    setAuthMode('login')
  }

  if (!user) {
    if (showForgotPassword) {
      return (
        <ForgotPassword 
          onBack={handleBackToLanding}
          onLoginRedirect={handleBackToLogin}
        />
      )
    }
    if (showAuth) {
      return (
        <Auth 
          onAuthSuccess={handleAuthSuccess} 
          initialMode={authMode}
          onBack={handleBackToLanding}
          onForgotPassword={handleForgotPassword}
        />
      )
    }
    return <Landing onNavigate={handleNavigate} />
  }

  return (
    <div className="min-h-screen transition-colors duration-300">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/contest/:id" element={<Contest/>} />
          <Route path="/leaderboard" element={<Leaderboard/>} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}