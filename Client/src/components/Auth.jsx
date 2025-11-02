import React, { useState } from 'react'

const EyeSVG = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const EyeOffSVG = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M17.94 17.94A10.06 10.06 0 0 1 12 19c-6 0-10-7-10-7a18.6 18.6 0 0 1 4.11-3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const CheckSVG = ({ size = 12, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

export default function Auth({ onAuthSuccess, initialMode = 'login', onBack }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login')
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
        ? 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(56,189,248,0.16) 50%, rgba(34,197,94,0.12) 100%)'
        : 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(236,72,153,0.16) 50%, rgba(253,224,71,0.12) 100%)'
    }}>
      {/* Header */}
      <div className="flex justify-between items-center p-6 shadow-sm border-b border-gray-100">
        <div className="flex items-center gap-3">
          
          <span className="text-gray-900 font-semibold text-lg">DSA DUEL</span>
        </div>
        
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-500 font-medium mr-8">
          <button type="button" aria-label="Home" onClick={onBack} className="p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 7.609c.352 0 .69.122.96.343l.111.1 6.25 6.25v.001a1.5 1.5 0 0 1 .445 1.071v7.5a.89.89 0 0 1-.891.891H9.125a.89.89 0 0 1-.89-.89v-7.5l.006-.149a1.5 1.5 0 0 1 .337-.813l.1-.11 6.25-6.25c.285-.285.67-.444 1.072-.444Zm5.984 7.876L16 9.5l-5.984 5.985v6.499h11.968z" fill="#475569" stroke="#475569" strokeWidth=".094"/>
            </svg>
          </button>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m14.413 10.663-6.25 6.25a.939.939 0 1 1-1.328-1.328L12.42 10 6.836 4.413a.939.939 0 1 1 1.328-1.328l6.25 6.25a.94.94 0 0 1-.001 1.328" fill="#000000"/>
          </svg>
          <span className="text-indigo-500 font-semibold">{isLogin ? 'Sign In' : 'Sign Up'}</span>
        </div>
        
        <button 
          onClick={() => setIsLogin(!isLogin)}
          // inline styles to guarantee visibility over gradient
          style={{
            backgroundColor: '#ffffff',
            color: '#111827',
            padding: '6px 10px',
            border: '2px solid #000000',
            borderRadius: 8,
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            fontSize: '0.875rem',
            outline: '2px solid rgba(0,0,0,0.95)',
            outlineOffset: 2,
            zIndex: 60,
            cursor: 'pointer'
          }}
        >
          {isLogin ? 'SIGN UP' : 'SIGN IN'}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center px-6 pt-8" style={{ minHeight: 'calc(100vh - 160px)' }}>
        <div className="bg-white rounded-xl shadow-lg ring-1 ring-gray-100 p-8 w-full max-w-md">
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white transition-shadow duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
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
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white transition-shadow duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white transition-shadow duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
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
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg bg-white transition-shadow duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  placeholder="••••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  // explicit absolute positioning so icon is locked to the right inside the input
                  className="text-gray-400 hover:text-gray-600 cursor-pointer focus:outline-none"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: 12, // matches input pr-12
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    padding: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 0,
                    zIndex: 20
                  }}
                >
                  {showPassword ? <EyeOffSVG size={18} /> : <EyeSVG size={18} />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  {/* custom accessible checkbox */}
                  <div
                     role="checkbox"
                     aria-checked={rememberMe}
                     tabIndex={0}
                     onClick={() => setRememberMe(!rememberMe)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' || e.key === ' ') {
                         e.preventDefault()
                         setRememberMe(!rememberMe)
                       }
                     }}
                     className={`w-5 h-5 flex items-center justify-center rounded-md transition-colors cursor-pointer select-none
                       ${rememberMe ? 'bg-black border-black' : 'bg-white border border-gray-300'}`}
                   >
                    {rememberMe && <CheckSVG size={12} color="#fff" />}
                   </div>
                  {/* text-only, accessible toggle (no background) */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setRememberMe(!rememberMe)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setRememberMe(!rememberMe)
                      }
                    }}
                    // match Forgot Password font size (text-sm)
                    className="text-sm font-medium text-gray-600 ml-2 cursor-pointer focus:outline-none"
                    style={{ background: 'transparent', padding: 0, border: 'none' }}
                  >
                    Remember Me
                  </span>
                </div>
                <button
                  type="button"
                  // inline style so it's always slightly visible
                  style={{
                    backgroundColor: '#f8fafc',
                    color: '#6b7280',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              // inline style to guarantee black/white appearance
              style={{
                width: '100%',
                backgroundColor: '#000000',
                color: '#ffffff',
                padding: '12px 16px',
                borderRadius: 10,
                fontWeight: 600,
                border: 'none',
                boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
                marginTop: 18,
                cursor: loading ? 'default' : 'pointer'
              }}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : (isLogin ? 'PROCEED' : 'CREATE AN ACCOUNT')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}