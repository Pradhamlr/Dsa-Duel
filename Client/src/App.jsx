import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Contest from './pages/Contest'
import Leaderboard from './pages/Leaderboard'

export default function App(){
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