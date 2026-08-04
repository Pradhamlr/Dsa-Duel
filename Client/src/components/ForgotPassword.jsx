import React, { useState } from 'react'
import { API } from '../utils/api.js'

export default function ForgotPassword({ onBack, onLoginRedirect }) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP')
      }

      setSuccess('OTP sent to your email')
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Invalid OTP')
      }

      setSuccess('OTP verified successfully')
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setSuccess('Password reset successfully! You can now login with your new password.')
      setTimeout(() => onLoginRedirect(), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 55%, #0f172a 100%)'
    }}>
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-6 bg-gray-900/80 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-gray-100 font-semibold text-xl tracking-tight">DSA DUEL</span>
        </div>

        <div className="flex items-center space-x-2 text-sm text-gray-500 font-medium mr-8">
          <button type="button" aria-label="Home" onClick={onBack} className="p-1 rounded hover:bg-white hover:bg-opacity-10 transition-colors">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 7.609c.352 0 .69.122.96.343l.111.1 6.25 6.25v.001a1.5 1.5 0 0 1 .445 1.071v7.5a.89.89 0 0 1-.891.891H9.125a.89.89 0 0 1-.89-.89v-7.5l.006-.149a1.5 1.5 0 0 1 .337-.813l.1-.11 6.25-6.25c.285-.285.67-.444 1.072-.444Zm5.984 7.876L16 9.5l-5.984 5.985v6.499h11.968z" fill="#94a3b8" stroke="#94a3b8" strokeWidth=".094"/>
            </svg>
          </button>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m14.413 10.663-6.25 6.25a.939.939 0 1 1-1.328-1.328L12.42 10 6.836 4.413a.939.939 0 1 1 1.328-1.328l6.25 6.25a.94.94 0 0 1-.001 1.328" fill="#475569"/>
          </svg>
          <span className="text-indigo-400 font-semibold">Reset Password</span>
        </div>

        <button
          onClick={onLoginRedirect}
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
          Back to Login
        </button>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center px-8 pt-12" style={{ minHeight: 'calc(100vh - 160px)' }}>
        <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-white/10 p-10 w-full max-w-md">

          {/* Step Indicator */}
          <div className="flex justify-center mb-8">
            <div className="flex items-start w-64">
              {[1, 2, 3].map((stepNum, index) => (
                <React.Fragment key={stepNum}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      step >= stepNum
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : step === stepNum - 1
                        ? 'bg-indigo-500/10 text-indigo-400 border-2 border-indigo-500'
                        : 'bg-gray-800 text-gray-500'
                    }`}>
                      {step > stepNum ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : stepNum}
                    </div>
                    <span className={`text-xs mt-2 font-medium ${
                      step >= stepNum ? 'text-indigo-400' : 'text-gray-500'
                    }`}>
                      {stepNum === 1 ? 'Email' : stepNum === 2 ? 'Verify' : 'Reset'}
                    </span>
                  </div>
                  {index < 2 && (
                    // mt-5 (20px) = half the circle's own height (w-10/h-10 = 40px) --
                    // aligns this line to the circle's vertical center specifically,
                    // since items-center on the row above would instead center it
                    // against the taller circle+label column, sitting visibly too low.
                    <div className="flex-1 h-0.5 mx-4 mt-5 transition-all duration-300" style={{
                      backgroundColor: step > stepNum ? '#4f46e5' : '#334155'
                    }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-100 mb-3 tracking-tight">
              {step === 1 && 'Reset Password'}
              {step === 2 && 'Verify OTP'}
              {step === 3 && 'New Password'}
            </h1>
            <p className="text-gray-400">
              {step === 1 && 'Enter your email to receive an OTP'}
              {step === 2 && 'Enter the 6-digit code sent to your email'}
              {step === 3 && 'Create your new password'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-red-300">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border-l-4 border-green-500 rounded-r-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-green-300">{success}</p>
              </div>
            </div>
          )}

          {/* Step 1: Email Input */}
          {step === 1 && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-gray-600"
                  placeholder="johndoe@example.com"
                  required
                />
              </div>
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
                ) : 'Send OTP'}
              </button>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  ENTER OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-gray-600 text-center text-lg tracking-widest"
                  placeholder="123456"
                  maxLength="6"
                  required
                />
              </div>
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
                ) : 'Verify OTP'}
              </button>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  NEW PASSWORD
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    const password = e.target.value
                    setNewPassword(password)
                    setPasswordStrength(validatePasswordStrength(password))
                  }}
                  className="w-full px-4 py-3 border border-gray-700 rounded-xl bg-gray-800/50 text-gray-100 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 hover:border-gray-600"
                  placeholder="••••••••••"
                  minLength="8"
                  required
                />
              </div>
              {newPassword && (
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
                ) : 'Reset Password'}
              </button>
            </form>
          )}
          
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    </div>
  )
}