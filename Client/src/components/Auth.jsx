import React, { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    name: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dark, setDark] = useState(() => {
    try {
      const val = localStorage.getItem('duel_dark')
      if (val === null) return true
      return val === '1'
    } catch { return true }
  })

  useEffect(() => {
    try {
      if (dark) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
      localStorage.setItem('duel_dark', dark ? '1' : '0')
    } catch (e) {}
  }, [dark])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register'
      const payload = isLogin 
        ? { email: formData.email, username: formData.username, password: formData.password }
        : formData

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      // Store token and user data
      localStorage.setItem('duel_token', data.token)
      localStorage.setItem('duel_user', JSON.stringify(data.user))
      localStorage.setItem('duel_userId', data.user.id)
      localStorage.setItem('duel_name', data.user.name)

      onAuthSuccess(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-50">
        <button 
          onClick={() => setDark(d => !d)} 
          className="btn-neutral btn-sm" 
          aria-pressed={dark}
        >
          {dark ? 'Dark' : 'Light'}
        </button>
      </div>
      <div className="card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          {isLogin ? 'Login to DSA Duel' : 'Join DSA Duel'}
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-2">Display Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full"
                placeholder="Your display name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              {isLogin ? 'Email or Username' : 'Email'}
            </label>
            <input
              type={isLogin ? "text" : "email"}
              value={isLogin ? (formData.email || formData.username) : formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full"
              placeholder={isLogin ? "Email or username" : "your@email.com"}
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full"
                placeholder="Choose a username"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full"
              placeholder="Password"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:underline"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  )
}