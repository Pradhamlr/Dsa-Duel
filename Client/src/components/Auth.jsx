import React, { useState } from 'react'

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
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

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
    <div className="min-h-screen" style={{
      background: isLogin 
        ? 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 50%, #10B981 100%)'
        : 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F59E0B 100%)'
    }}>
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">DD</span>
          </div>
          <span className="text-white font-semibold text-lg">DSA DUEL</span>
        </div>
        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="px-6 py-2 border border-gray-800 text-gray-800 bg-white/80 rounded font-medium hover:bg-white transition-colors"
        >
          {isLogin ? 'SIGN UP' : 'SIGN IN'}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center px-6" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              {isLogin ? 'Log In to DSA Duel' : 'Sign up to DSA Duel'}
            </h1>
            <p className="text-gray-500 text-sm">
              Quick & Simple way to practice competitive programming
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  FIRST NAME
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  placeholder="John"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                placeholder="johndoe@example.com"
                required
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  USERNAME
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  placeholder="johndoe"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  placeholder="••••••••••"
                  required
                  minLength={6}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer select-none"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </span>
              </div>
            </div>

            

            {isLogin && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="remember" className="text-sm text-gray-600">
                    Remember Me
                  </label>
                </div>
                <button type="button" className="text-sm text-gray-600 hover:underline">
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-800 text-white py-3 rounded-md font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? 'Please wait...' : (isLogin ? 'PROCEED' : 'CREATE AN ACCOUNT')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}