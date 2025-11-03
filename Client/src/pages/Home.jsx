import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'
import { authFetch } from '../utils/api'

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m15 18-6-6 6-6"/>
  </svg>
)

export default function Home(){
  const [currentStep, setCurrentStep] = useState(1)
  const [num, setNum] = useState(5)
  const [difficulty, setDifficulty] = useState('mixed')
  const [topic, setTopic] = useState('All')
  const [durationMin, setDurationMin] = useState(90)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [createdLink, setCreatedLink] = useState('')
  const [dark, setDark] = useState(() => {
    try {
      const val = localStorage.getItem('duel_dark')
      if (val === null) return true
      return val === '1'
    } catch { return true }
  })

  useEffect(()=>{
    try {
      if (dark) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
      localStorage.setItem('duel_dark', dark ? '1' : '0')
    } catch (e) {}
  }, [dark])

  async function create(){
    try {
      setLoading(true)
      
      const res = await authFetch('/create-contest', {
        method: 'POST',
        body: JSON.stringify({ 
          numProblems: Number(num), 
          difficulty, 
          topic: topic !== 'All' ? topic : undefined,
          duration: Number(durationMin) * 60 
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(()=>({ error: 'failed' }))
        throw new Error(err.error || 'Failed to create contest')
      }

      const data = await res.json()
      setLoading(false)
      if (data.contestId) {
        const url = `${window.location.origin}/contest/${data.contestId}`
        setCreatedLink(url)
        window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Contest created', type:'success'}}))
        navigate(`/contest/${data.contestId}`)
      }
    } catch (err) {
      console.error('create error', err)
      setLoading(false)
      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message: err.message || 'Failed to create', type:'error'}}))
    }
  }

  const steps = [
    { id: 1, title: 'Problem Count', desc: 'Choose number of problems' },
    { id: 2, title: 'Difficulty Level', desc: 'Select problem difficulty' },
    { id: 3, title: 'Topic Selection', desc: 'Choose problem categories' },
    { id: 4, title: 'Duration', desc: 'Set contest duration' }
  ]

  const difficultyCards = [
    { id: 'Easy', label: 'Easy', color: 'from-green-400 to-green-600', icon: '🟢' },
    { id: 'Medium', label: 'Medium', color: 'from-yellow-400 to-orange-500', icon: '🟡' },
    { id: 'mixed', label: 'Mixed', color: 'from-purple-400 to-pink-600', icon: '🎯' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-fadeIn">
      {/* Navbar */}
      <div className="flex justify-between items-center p-6 bg-gradient-to-r from-blue-50/80 to-purple-50/80 backdrop-blur-sm shadow-sm border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-gray-900 font-semibold text-lg">DSA DUEL</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={()=>setDark(d=>!d)} 
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors" 
            aria-pressed={dark}
          >
            <SunIcon />
          </button>
          <button 
            onClick={()=>navigate('/leaderboard')} 
            style={{
              backgroundColor: '#f8fafc',
              color: '#374151',
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f1f5f9'
              e.target.style.borderColor = '#9ca3af'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f8fafc'
              e.target.style.borderColor = '#d1d5db'
            }}
          >
            LEADERBOARD
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('duel_token')
              localStorage.removeItem('duel_user')
              window.location.reload()
            }}
            style={{
              backgroundColor: '#ffffff',
              color: '#111827',
              padding: '6px 12px',
              border: '2px solid #000000',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              fontSize: '0.875rem',
              fontWeight: '500',
              outline: '2px solid rgba(0,0,0,0.95)',
              outlineOffset: '2px',
              cursor: 'pointer'
            }}
          >
            LOGOUT
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-6" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-4xl flex flex-col md:flex-row gap-8">
          {/* Left Sidebar */}
          <div className="hidden md:block w-80 h-86 bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 flex items-center my-auto">
            <div className="relative w-full">
              {steps.map((step, idx) => (
                <div key={step.id} className="relative">
                  <div className="flex items-start gap-4 py-4">
                    <div className="relative z-10">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium shadow-lg transition-all duration-300 ${
                        currentStep >= step.id ? 'bg-blue-600 text-white shadow-blue-200' :
                        'bg-gray-200 text-gray-500 shadow-gray-200'
                      }`}>
                        {step.id}
                      </div>
                    </div>
                    <div className="flex-1 pt-2">
                      <div className={`font-medium mb-1 ${
                        currentStep >= step.id ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {step.title}
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Line */}
                  {idx < steps.length - 1 && (
                    <div className="absolute left-5 top-14 w-0.5 h-12 -translate-x-0.5">
                      <div className="w-full h-full bg-gray-200 rounded-full"></div>
                      <div className={`absolute top-0 left-0 w-full rounded-full transition-all duration-500 ease-in-out ${
                        currentStep > step.id ? 'h-full bg-gradient-to-b from-blue-500 to-blue-600 shadow-sm' :
                        currentStep === step.id ? 'h-1/2 bg-gradient-to-b from-blue-500 to-blue-600 shadow-sm' :
                        'h-0 bg-gradient-to-b from-blue-500 to-blue-600'
                      }`}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">

            {/* Step 1: Problem Count */}
            {currentStep === 1 && (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200 animate-slideIn">
                <p className="text-2xl font-semibold mb-8 text-gray-900">Pick a pace that fits your focus right now</p>
                
                <div className="flex justify-center">
                  <div className="inline-flex bg-gray-100 rounded-2xl p-1.5">
                    {[
                      { count: 3, label: 'Short Session' },
                      { count: 4, label: 'Standard Match' },
                      { count: 5, label: 'Focused Run' }
                    ].map(option => (
                      <button
                        key={option.count}
                        onClick={() => setNum(option.count)}
                        className={`relative px-10 py-5 rounded-xl transition-all duration-300 ease-out group ${
                          num === option.count 
                            ? 'bg-white shadow-lg transform scale-105' 
                            : 'hover:bg-white/50 hover:shadow-md hover:transform hover:scale-102'
                        }`}
                        style={{
                          boxShadow: num === option.count 
                            ? '0 8px 25px rgba(0,0,0,0.1), 0 0 0 1px rgba(59,130,246,0.1)' 
                            : undefined
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <div className={`text-2xl font-semibold mb-1 transition-colors duration-200 ${
                            num === option.count ? 'text-blue-600' : 'text-gray-700 group-hover:text-gray-900'
                          }`}>
                            {option.count}
                          </div>
                          <div className={`text-xs font-medium transition-colors duration-200 ${
                            num === option.count ? 'text-blue-500' : 'text-gray-500 group-hover:text-gray-600'
                          }`}>
                            {option.label}
                          </div>
                        </div>
                        {num === option.count && (
                          <div className="absolute inset-0 rounded-xl bg-blue-50/50 animate-pulse"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <button 
                    onClick={() => setCurrentStep(2)}
                    className="group relative overflow-hidden"
                    style={{
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      padding: '8px 48px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)'
                      e.target.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)'
                      e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    <span className="relative z-10">CONTINUE</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Difficulty Level */}
            {currentStep === 2 && (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200 animate-slideIn">
                <h2 className="text-2xl font-semibold mb-2 text-gray-900">Difficulty Level</h2>
                <p className="text-gray-600 mb-8">Select problem difficulty</p>
                
                <div className="relative">
                  <div className="relative w-full max-w-lg mx-auto">
                    {/* Track with subtle gradient */}
                    <div className="h-1.5 bg-gradient-to-r from-emerald-100 via-amber-100 to-violet-100 rounded-full relative">
                      {/* Tick marks */}
                      {difficultyCards.map((card, idx) => (
                        <div
                          key={card.id}
                          className={`absolute top-1/2 w-2 h-2 rounded-full transform -translate-y-1/2 transition-all duration-300 ${
                            difficulty === card.id
                              ? 'bg-gray-700 scale-125 shadow-sm'
                              : 'bg-gray-300'
                          }`}
                          style={{ left: `calc(${idx * 50}% - 4px)` }}
                        />
                      ))}
                      
                      {/* Slider thumb */}
                      <div
                        className={`absolute top-1/2 w-5 h-5 bg-white rounded-full shadow-md transform -translate-y-1/2 transition-all duration-300 ease-out border border-gray-200 ${
                          difficultyCards.some(card => card.id === difficulty) ? 'scale-110 shadow-lg' : ''
                        }`}
                        style={{
                          left: `calc(${difficultyCards.findIndex(card => card.id === difficulty) * 50}% - 10px)`,
                          boxShadow: difficultyCards.some(card => card.id === difficulty) 
                            ? '0 4px 16px rgba(0,0,0,0.12), 0 0 0 2px rgba(99,102,241,0.08)' 
                            : '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      />
                    </div>
                    
                    {/* Clickable areas */}
                    <div className="flex absolute inset-0 py-2">
                      {difficultyCards.map((card, idx) => (
                        <button
                          key={card.id}
                          onClick={() => setDifficulty(card.id)}
                          className="flex-1 cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-8 text-center">
                    <div className={`text-lg font-medium transition-colors duration-300 ${
                      difficulty === 'Easy' ? 'text-emerald-700' :
                      difficulty === 'Medium' ? 'text-amber-700' :
                      'text-violet-700'
                    }`}>
                      {difficulty === 'Easy' ? 'Easy' :
                       difficulty === 'Medium' ? 'Medium' :
                       'Mixed'}
                    </div>
                    <div className="text-sm text-gray-500 mt-1 transition-all duration-300">
                      {difficulty === 'Easy' ? 'Beginner-friendly problems' :
                       difficulty === 'Medium' ? 'Balanced challenge level' :
                       'Varied difficulty range'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <button 
                    onClick={() => setCurrentStep(1)}
                    className="p-3 rounded-lg hover:bg-gray-100 transition-all duration-200 flex items-center justify-center group"
                    style={{
                      border: '1px solid #e5e7eb',
                      cursor: 'pointer'
                    }}
                  >
                    <BackIcon />
                  </button>
                  <button 
                    onClick={() => setCurrentStep(3)}
                    className="group relative overflow-hidden"
                    style={{
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      padding: '8px 48px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)'
                      e.target.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)'
                      e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    <span className="relative z-10">CONTINUE</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Topic Selection */}
            {currentStep === 3 && (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200 animate-slideIn">
                <h2 className="text-2xl font-semibold mb-2 text-gray-900">Topic Selection</h2>
                <p className="text-gray-600 mb-6">Choose problem categories</p>
                
                <div className="flex justify-between items-center mb-6">
                  <div className="text-sm text-gray-600">
                    Selected: <span className="font-semibold text-blue-600">{topic === 'All' ? 'Any Topic' : topic}</span>
                  </div>
                  <button 
                    onClick={() => {
                      const topics = ['Array', 'Linked List', 'Tree', 'Graph', 'String', 'DP', 'Stack/Queue', 'Matrix', 'Hash / Map', 'Binary Search', 'Two Pointers', 'Other']
                      const randomTopic = topics[Math.floor(Math.random() * topics.length)]
                      setTopic(randomTopic)
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    Randomize
                  </button>
                </div>
                
                <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                  {[
                    { id: 'All', label: 'Any Topic', color: 'from-gray-400 to-gray-600' },
                    { id: 'Array', label: 'Array', icon: '📊', color: 'from-blue-400 to-blue-600' },
                    { id: 'Linked List', label: 'Linked List', icon: '🔗', color: 'from-green-400 to-green-600' },
                    { id: 'Tree', label: 'Tree', icon: '🌳', color: 'from-emerald-400 to-emerald-600' },
                    { id: 'Graph', label: 'Graph', icon: '🕸️', color: 'from-purple-400 to-purple-600' },
                    { id: 'String', label: 'String', icon: '📝', color: 'from-yellow-400 to-yellow-600' },
                    { id: 'DP', label: 'DP', icon: '⚡', color: 'from-red-400 to-red-600' },
                    { id: 'Stack/Queue', label: 'Stack/Queue', icon: '📦', color: 'from-indigo-400 to-indigo-600' },
                    { id: 'Matrix', label: 'Matrix', icon: '🔢', color: 'from-teal-400 to-teal-600' },
                    { id: 'Hash / Map', label: 'Hash/Map', icon: '🗺️', color: 'from-orange-400 to-orange-600' },
                    { id: 'Binary Search', label: 'Binary Search', icon: '🔍', color: 'from-pink-400 to-pink-600' },
                    { id: 'Two Pointers', label: 'Two Pointers', icon: '👉', color: 'from-cyan-400 to-cyan-600' },
                    { id: 'Other', label: 'Other', icon: '🎯', color: 'from-violet-400 to-violet-600' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTopic(t.id)}
                      className={`group relative p-4 rounded-xl border-2 text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                        topic === t.id 
                          ? `border-transparent shadow-xl bg-gradient-to-br ${t.color} text-white scale-105` 
                          : 'border-gray-200 hover:border-gray-300 bg-white/70 hover:shadow-lg'
                      }`}
                    >
                      <div className={`text-xs ${topic === t.id ? 'text-white' : 'text-gray-700'}`}>{t.label}</div>
                      {topic === t.id && (
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                      )}
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </button>
                  ))}
                </div>

                <div className="flex justify-between mt-8">
                  <button 
                    onClick={() => setCurrentStep(2)}
                    className="p-3 rounded-lg hover:bg-gray-100 transition-all duration-200 flex items-center justify-center group"
                    style={{
                      border: '1px solid #e5e7eb',
                      cursor: 'pointer'
                    }}
                  >
                    <BackIcon />
                  </button>
                  <button 
                    onClick={() => setCurrentStep(4)}
                    className="group relative overflow-hidden"
                    style={{
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      padding: '8px 48px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)'
                      e.target.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)'
                      e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    <span className="relative z-10">CONTINUE</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Duration */}
            {currentStep === 4 && (
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200 animate-slideIn">
                <h2 className="text-2xl font-semibold mb-2 text-gray-900">Duration</h2>
                <p className="text-gray-600 mb-8">Set contest duration</p>
                
                <div className="flex flex-col items-center mb-8">
                  <div className="relative w-48 h-48 mb-6">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="url(#gradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(durationMin - 10) / (240 - 10) * 283} 283`}
                        className="transition-all duration-500 ease-out"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-4xl font-bold text-gray-900">{durationMin}</div>
                      <div className="text-sm text-gray-500 font-medium">minutes</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {durationMin <= 30 ? 'Blitz' : durationMin <= 90 ? 'Standard' : durationMin <= 150 ? 'Extended' : 'Marathon'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full max-w-md">
                    <input
                      type="range"
                      min={10}
                      max={240}
                      step={5}
                      value={durationMin}
                      onChange={e => setDurationMin(Number(e.target.value))}
                      className="w-full h-3 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #8b5cf6 ${(durationMin - 10) / (240 - 10) * 100}%, #e5e7eb ${(durationMin - 10) / (240 - 10) * 100}%, #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-3">
                      <span className="flex flex-col items-center">
                        <span>10m</span>
                        <span className="text-xs text-gray-400">Quick</span>
                      </span>
                      <span className="flex flex-col items-center">
                        <span>90m</span>
                        <span className="text-xs text-gray-400">Standard</span>
                      </span>
                      <span className="flex flex-col items-center">
                        <span>240m</span>
                        <span className="text-xs text-gray-400">Epic</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-6 text-center">
                    <div className="text-lg font-semibold text-gray-900 mb-1">
                      {durationMin <= 30 ? '⚡ Lightning Round' : 
                       durationMin <= 90 ? '⚔️ Battle Mode' : 
                       durationMin <= 150 ? '🏆 Championship' : '🔥 Ultimate Challenge'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {durationMin <= 30 ? 'Fast-paced coding sprint' : 
                       durationMin <= 90 ? 'Balanced challenge time' : 
                       durationMin <= 150 ? 'Extended problem solving' : 'Marathon coding session'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button 
                    onClick={() => setCurrentStep(3)}
                    className="p-3 rounded-lg hover:bg-gray-100 transition-all duration-200 flex items-center justify-center group"
                    style={{
                      border: '1px solid #e5e7eb',
                      cursor: 'pointer'
                    }}
                  >
                    <BackIcon />
                  </button>
                  <button 
                    onClick={create}
                    disabled={loading}
                    className="group relative overflow-hidden"
                    style={{
                      backgroundColor: loading ? '#666666' : '#000000',
                      color: '#ffffff',
                      padding: '8px 48px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? '0.8' : '1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.target.style.transform = 'translateY(-2px)'
                        e.target.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.target.style.transform = 'translateY(0)'
                        e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                      }
                    }}
                  >
                    <span className="relative z-10">
                      {loading ? (
                        <>
                          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                          CREATING...
                        </>
                      ) : (
                        'CREATE CONTEST'
                      )}
                    </span>
                    {!loading && (
                      <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    )}
                  </button>
                </div>
              </div>
            )}


            {createdLink && (
              <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-lg border border-green-200 animate-slideIn">
                <div className="text-sm font-medium mb-3 text-green-800">
                  Contest created successfully!
                </div>
                <div className="flex gap-3">
                  <input 
                    className="flex-1 text-sm" 
                    value={createdLink} 
                    readOnly 
                  />
                  <button 
                    onClick={async ()=>{ 
                      await navigator.clipboard.writeText(createdLink); 
                      window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Link copied!', type:'success'}})) 
                    }} 
                    className="btn-secondary"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
        
      <Toast />
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
            <div className="relative">
              <div className="animate-spin h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-6 w-6 bg-blue-600 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold mb-1">Preparing your contest</div>
              <div className="text-sm text-muted">Selecting the best problems for you...</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}