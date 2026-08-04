import React, { useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import { API, storeAuthSession } from '../utils/api'

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

// Google's real four-color "G" mark -- the standard asset Google's own branding
// guidelines provide for sign-in buttons, not a generic/monochrome stand-in.
const GoogleLogo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
)

export default function Auth({ onAuthSuccess, initialMode = 'login', onBack, onForgotPassword }) {
  const { showError, showSuccess } = useToast()
  const [isLogin, setIsLogin] = useState(initialMode === 'login')
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    name: ''
  })
  const [loading, setLoading] = useState(false)
  const [, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] })

  const validatePasswordStrength = (password) => {
    const feedback = []
    let score = 0
    
    if (password.length >= 8) score++
    else feedback.push('At least 8 characters')
    
    if (/[a-z]/.test(password)) score++
    else feedback.push('One lowercase letter')
    
    if (/[A-Z]/.test(password)) score++
    else feedback.push('One uppercase letter')
    
    if (/\d/.test(password)) score++
    else feedback.push('One number')
    
    if (/[@$!%*?&]/.test(password)) score++
    else feedback.push('One special character (@$!%*?&)')
    
    return { score, feedback }
  }

  const handleModeSwitch = () => {
    setIsLogin(!isLogin)
    setFormData({
      email: '',
      username: '',
      password: '',
      name: ''
    })
    setError('')
    setPasswordStrength({ score: 0, feedback: [] })
  }

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
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      if (isLogin) {
        storeAuthSession(data)

        showSuccess('Welcome back!')
        onAuthSuccess(data.user)
      } else {
        // Registration successful, show verification screen
        showSuccess('Registration successful! Please check your email for verification.')
        onAuthSuccess({ needsVerification: true, email: formData.email })
      }
    } catch (err) {
      showError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = `${API}/auth/google`
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: isLogin
        ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 55%, #0f172a 100%)'
        : 'linear-gradient(135deg, #3b0764 0%, #0f172a 55%, #0f172a 100%)'
    }}>
      {/* Soft ambient glow behind the card -- the flat gradient alone left the space
          above/below the form feeling empty; this gives the page some depth without
          competing with the form itself. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>
      {/* Header */}
      <div className="relative z-10 flex justify-between items-center px-8 py-6 bg-gray-900/80 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-gray-100 font-semibold text-xl tracking-tight">DSA DUEL</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-500 font-medium mr-8">
          <button type="button" aria-label="Home" onClick={onBack} className="p-1 rounded hover:bg-white hover:bg-opacity-10 transition-colors">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 7.609c.352 0 .69.122.96.343l.111.1 6.25 6.25v.001a1.5 1.5 0 0 1 .445 1.071v7.5a.89.89 0 0 1-.891.891H9.125a.89.89 0 0 1-.89-.89v-7.5l.006-.149a1.5 1.5 0 0 1 .337-.813l.1-.11 6.25-6.25c.285-.285.67-.444 1.072-.444Zm5.984 7.876L16 9.5l-5.984 5.985v6.499h11.968z" fill="#94a3b8" stroke="#94a3b8" strokeWidth=".094"/>
            </svg>
          </button>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m14.413 10.663-6.25 6.25a.939.939 0 1 1-1.328-1.328L12.42 10 6.836 4.413a.939.939 0 1 1 1.328-1.328l6.25 6.25a.94.94 0 0 1-.001 1.328" fill="#475569"/>
          </svg>
          <span className="text-indigo-400 font-semibold">{isLogin ? 'Sign In' : 'Sign Up'}</span>
        </div>

        <button
          onClick={handleModeSwitch}
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
            color: '#ffffff',
            padding: '8px 20px',
            border: 'none',
            borderRadius: 9999,
            boxShadow: '0 2px 10px rgba(99,102,241,0.18)',
            fontSize: '0.875rem',
            fontWeight: '600',
            zIndex: 60,
            cursor: 'pointer'
          }}
        >
          {isLogin ? 'Sign Up' : 'Sign In'}
        </button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center px-8 py-12" style={{ minHeight: 'calc(100vh - 160px)' }}>
        <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-white/10 p-10 w-full max-w-md">
          <div className="text-center mb-8">

            <h1 className="text-3xl font-bold text-gray-100 mb-3 tracking-tight">
              {isLogin ? 'Welcome back' : 'Join DSA Duel'}
            </h1>
            <p className="text-gray-400">
              {isLogin ? 'Sign in to continue your coding journey' : 'Start your competitive programming adventure'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  FIRST NAME
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-gray-600"
                  placeholder="John"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-gray-600"
                placeholder="johndoe@example.com"
                required
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  USERNAME
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-gray-600"
                  placeholder="johndoe"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => {
                    const newPassword = e.target.value
                    setFormData({...formData, password: newPassword})
                    if (!isLogin) {
                      setPasswordStrength(validatePasswordStrength(newPassword))
                    }
                  }}
                  className="w-full px-4 py-3 pr-12 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-gray-600"
                  placeholder="••••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  // explicit absolute positioning so icon is locked to the right inside the input
                  className="text-gray-500 hover:text-gray-300 cursor-pointer focus:outline-none"
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
              {!isLogin && formData.password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          passwordStrength.score <= 2 ? 'bg-red-500' :
                          passwordStrength.score <= 4 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      passwordStrength.score <= 2 ? 'text-red-400' :
                      passwordStrength.score <= 4 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {passwordStrength.score <= 2 ? 'Weak' :
                       passwordStrength.score <= 4 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <div className="text-xs text-gray-500">
                      <span>Required: </span>
                      {passwordStrength.feedback.join(', ')}
                    </div>
                  )}
                </div>
              )}
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
                       ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-800 border border-gray-600'}`}
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
                    className="text-sm font-medium text-gray-400 ml-2 cursor-pointer focus:outline-none"
                    style={{ background: 'transparent', padding: 0, border: 'none' }}
                  >
                    Remember Me
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  // Tailwind's hover:text-* utility loses here -- index.css's plain,
                  // unlayered `button { color: var(--text) }` rule beats any Tailwind
                  // utility class regardless of specificity (unlayered CSS always wins
                  // over @layer'd rules). Same root cause as this file's documented
                  // button-background gotcha, just for color -- driving it via inline
                  // style + mouse handlers sidesteps it entirely, same as the header's
                  // own LOGIN button already does. Also explicitly overriding
                  // backdropFilter/borderRadius/boxShadow (base button {} sets a blur +
                  // rounded corners, and its :hover rule adds a box-shadow, regardless
                  // of the JS handlers below) -- without these, a faint blurred oval
                  // stayed visible behind the text even with a transparent background,
                  // since backdrop-filter blurs whatever's behind it, box or not.
                  style={{
                    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: '0.875rem', fontWeight: 500, color: '#818cf8',
                    transition: 'color 150ms ease', backdropFilter: 'none', borderRadius: 0,
                    boxShadow: 'none', transform: 'none'
                  }}
                  onMouseEnter={(e) => { e.target.style.color = '#c084fc' }}
                  onMouseLeave={(e) => { e.target.style.color = '#818cf8' }}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#475569' : 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
                color: '#ffffff',
                padding: '8px 48px',
                borderRadius: '10px',
                fontWeight: '600',
                border: 'none',
                boxShadow: '0 2px 10px rgba(99,102,241,0.18)',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '24px',
                opacity: loading ? '0.8' : '1'
              }}
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #ffffff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Please wait...
                </div>
              ) : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-gray-700"></div>
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">or</span>
              <div className="h-px flex-1 bg-gray-700"></div>
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-700 rounded-xl bg-gray-800 text-gray-200 font-semibold shadow-sm hover:border-gray-600 hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <GoogleLogo size={18} />
              Continue with Google
            </button>
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </form>
        </div>
      </div>
    </div>
  )
}
