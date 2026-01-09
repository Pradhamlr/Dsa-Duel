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
      background: 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(56,189,248,0.16) 50%, rgba(34,197,94,0.12) 100%)'
    }}>
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-6 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-gray-900 font-semibold text-xl tracking-tight">DSA DUEL</span>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-500 font-medium mr-8">
          <button type="button" aria-label="Home" onClick={onBack} className="p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 7.609c.352 0 .69.122.96.343l.111.1 6.25 6.25v.001a1.5 1.5 0 0 1 .445 1.071v7.5a.89.89 0 0 1-.891.891H9.125a.89.89 0 0 1-.89-.89v-7.5l.006-.149a1.5 1.5 0 0 1 .337-.813l.1-.11 6.25-6.25c.285-.285.67-.444 1.072-.444Zm5.984 7.876L16 9.5l-5.984 5.985v6.499h11.968z" fill="#475569" stroke="#475569" strokeWidth=".094"/>
            </svg>
          </button>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m14.413 10.663-6.25 6.25a.939.939 0 1 1-1.328-1.328L12.42 10 6.836 4.413a.939.939 0 1 1 1.328-1.328l6.25 6.25a.94.94 0 0 1-.001 1.328" fill="#000000"/>
          </svg>
          <span className="text-indigo-500 font-semibold">Reset Password</span>
        </div>
        
        <button 
          onClick={onLoginRedirect}
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
          BACK TO LOGIN
        </button>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center px-8 pt-12" style={{ minHeight: 'calc(100vh - 160px)' }}>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-gray-200/50 p-10 w-full max-w-md">
          
          {/* Step Indicator */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= stepNum ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {stepNum}
                  </div>
                  {stepNum < 3 && (
                    <div className={`w-8 h-0.5 ${step > stepNum ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
              {step === 1 && 'Reset Password'}
              {step === 2 && 'Verify OTP'}
              {step === 3 && 'New Password'}
            </h1>
            <p className="text-gray-600">
              {step === 1 && 'Enter your email to receive an OTP'}
              {step === 2 && 'Enter the 6-digit code sent to your email'}
              {step === 3 && 'Create your new password'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {success}
            </div>
          )}

          {/* Step 1: Email Input */}
          {step === 1 && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 hover:border-gray-300"
                  placeholder="johndoe@example.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  backgroundColor: loading ? '#666666' : '#000000',
                  color: '#ffffff',
                  padding: '8px 48px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
                <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  ENTER OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 hover:border-gray-300 text-center text-lg tracking-widest"
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
                  backgroundColor: loading ? '#666666' : '#000000',
                  color: '#ffffff',
                  padding: '8px 48px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
                <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  NEW PASSWORD
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 hover:border-gray-300"
                  placeholder="••••••••••"
                  minLength="6"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  backgroundColor: loading ? '#666666' : '#000000',
                  color: '#ffffff',
                  padding: '8px 48px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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