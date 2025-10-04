import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Contest from './pages/Contest'
import ApiBadge from './components/ApiBadge'
import Leaderboard from './pages/Leaderboard'

export default function App(){
  return (
    <BrowserRouter>
      <ApiBadge />
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/contest/:id" element={<Contest/>} />
        <Route path="/leaderboard" element={<Leaderboard/>} />
      </Routes>
    </BrowserRouter>
  )
}