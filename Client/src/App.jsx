import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Contest from './pages/Contest'
import Leaderboard from './pages/Leaderboard'
import Auth from './components/Auth'

export default function App(){
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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

  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <div className="min-h-screen transition-colors duration-300">
      <BrowserRouter>
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
          <span className="text-sm">Welcome, {user.name || user.username}</span>
          <button onClick={handleLogout} className="btn-neutral btn-sm">
            Logout
          </button>
        </div>
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/contest/:id" element={<Contest/>} />
          <Route path="/leaderboard" element={<Leaderboard/>} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}