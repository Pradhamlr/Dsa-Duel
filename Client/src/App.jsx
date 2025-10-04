import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Contest from './pages/Contest'
import ApiBadge from './components/ApiBadge'

export default function App(){
  return (
    <BrowserRouter>
      <ApiBadge />
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/contest/:id" element={<Contest/>} />
      </Routes>
    </BrowserRouter>
  )
}