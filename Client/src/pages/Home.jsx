import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sessions from '../components/Sessions'
import { authFetch, clearAuthSession, logout } from '../utils/api'

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
  const [difficulty, setDifficulty] = useState('Mixed')
  const [topic, setTopic] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [durationMin, setDurationMin] = useState(90)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [createdLink, setCreatedLink] = useState('')
  const [dark, setDark] = useState(false)
  const [showSessions, setShowSessions] = useState(false)

  // Verify user exists on mount
  useEffect(() => {
    const verifyUserExists = async () => {
      try {
        const token = localStorage.getItem('duel_access_token')
        if (!token) {
          navigate('/')
          return
        }

        const response = await authFetch('/auth/me')
        if (!response.ok) {
          // User doesn't exist - clear data and redirect home
          clearAuthSession()
          navigate('/')
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Your account was deleted. Please log in again.', type: 'error' } }))
        }
      } catch (error) {
        console.error('User verification error:', error)
      }
    }

    verifyUserExists()
  }, [navigate])

  useEffect(()=>{
    // Dark mode disabled
  }, [])

  async function create(){
    try {
      setLoading(true)
      
      const res = await authFetch('/create-contest', {
        method: 'POST',
        body: JSON.stringify({ 
          numProblems: Number(num), 
          difficulty, 
          selectedTopics: topic !== 'All' ? [topic] : [],
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
    { id: 'Easy', label: 'Easy', color: 'from-green-400 to-green-600', icon: 'E' },
    { id: 'Medium', label: 'Medium', color: 'from-yellow-400 to-orange-500', icon: 'M' },
    { id: 'Mixed', label: 'Mixed', color: 'from-purple-400 to-pink-600', icon: 'Mix' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/20 to-purple-950/10 animate-fadeIn font-inter relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl"></div>
      </div>
      {/* Navbar */}
      <div className="relative z-20 flex justify-between items-center px-8 py-6 bg-gray-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-6">
          <span className="text-gray-100 font-semibold text-xl tracking-tight">DSA DUEL</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">/</span>
            <span className="text-gray-400 font-medium">Create Contest</span>
            <span className="text-gray-600">/</span>
            <span className="text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text font-medium">
              {currentStep === 1 ? 'Problem Count' :
               currentStep === 2 ? 'Difficulty' :
               currentStep === 3 ? 'Topics' :
               'Duration'}
            </span>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <div className="text-center">
            <div className="text-sm text-gray-500 font-medium">Welcome back,</div>
            <div className="text-lg font-semibold text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text">
              {(() => {
                try {
                  const user = JSON.parse(localStorage.getItem('duel_user') || '{}')
                  return user.username || user.name || 'Developer'
                } catch {
                  return 'Developer'
                }
              })()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="p-2 rounded-lg hover:bg-white/5 transition-colors opacity-50 cursor-not-allowed"
            disabled
          >
            <SunIcon />
          </button>
          <button
            onClick={() => setShowSessions(true)}
            style={{
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              padding: '6px 12px',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#293548'
              e.target.style.borderColor = '#475569'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#1e293b'
              e.target.style.borderColor = '#334155'
            }}
          >
            SESSIONS
          </button>
          <button
            onClick={()=>navigate('/leaderboard')}
            style={{
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              padding: '6px 12px',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#293548'
              e.target.style.borderColor = '#475569'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#1e293b'
              e.target.style.borderColor = '#334155'
            }}
          >
            LEADERBOARD
          </button>
          <button
            onClick={async () => {
              await logout()
              window.location.reload()
            }}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
              color: '#ffffff',
              padding: '6px 12px',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            LOGOUT
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center px-8 py-12" style={{ minHeight: 'calc(100vh - 88px)' }}>
        <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-12">
          {/* Enhanced Sidebar */}
          <div className="hidden lg:block w-80">
            <div className="bg-gray-900 rounded-2xl p-8 shadow-sm border border-white/10 sticky top-8">
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-100 mb-2">Contest Setup</h3>
                <p className="text-sm text-gray-500">Step {currentStep} of {steps.length}</p>
              </div>

              <div className="relative">
                {steps.map((step, idx) => (
                  <div key={step.id} className="relative">
                    <div className="flex items-center gap-4 py-4">
                      <div className="relative z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                          currentStep >= step.id
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                            : 'bg-gray-800 text-gray-500 border-2 border-gray-700'
                        }`}>
                          {currentStep > step.id ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : step.id}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium text-sm transition-colors duration-300 ${
                          currentStep >= step.id ? 'text-gray-100' : 'text-gray-500'
                        }`}>
                          {step.title}
                        </div>
                        <div className={`text-xs mt-1 transition-colors duration-300 ${
                          currentStep >= step.id ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {step.desc}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Progress Line */}
                    {idx < steps.length - 1 && (
                      <div className="absolute left-5 top-14 w-0.5 h-8 -translate-x-0.5">
                        <div className="w-full h-full bg-gray-700 rounded-full"></div>
                        <div className={`absolute top-0 left-0 w-full rounded-full transition-all duration-700 ease-out ${
                          currentStep > step.id ? 'h-full bg-gradient-to-b from-indigo-600 to-purple-600' :
                          currentStep === step.id ? 'h-1/2 bg-gradient-to-b from-indigo-600 to-purple-600' :
                          'h-0 bg-gradient-to-b from-indigo-600 to-purple-600'
                        }`}></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Enhanced Main Content */}
          <div className="flex-1 min-w-0 relative z-10">

            {/* Step 1: Problem Count */}
            {currentStep === 1 && (
              <div className="bg-gray-900 rounded-2xl p-12 shadow-sm border border-white/10 animate-fadeIn">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-semibold text-gray-100 mb-4 tracking-tight">Choose Your Challenge</h2>
                  <p className="text-gray-400 text-lg">Select the number of problems for your contest</p>
                </div>

                <div className="flex justify-center mb-16">
                  <div className="grid grid-cols-3 gap-6">
                    {[
                      { count: 3, label: 'Quick Sprint', desc: '15-30 min' },
                      { count: 4, label: 'Standard', desc: '30-45 min' },
                      { count: 5, label: 'Deep Focus', desc: '45-60 min' }
                    ].map(option => (
                      <button
                        key={option.count}
                        onClick={() => setNum(option.count)}
                        className={`relative p-8 rounded-2xl border-2 transition-all duration-300 group ${
                          num === option.count
                            ? 'border-indigo-500 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 shadow-lg shadow-indigo-500/20 scale-105'
                            : 'border-gray-700 bg-gray-900 hover:border-gray-600 hover:shadow-md hover:scale-102'
                        }`}
                      >
                        <div className="text-center">
                          <div className={`text-4xl font-bold mb-3 transition-colors duration-300 ${
                            num === option.count ? 'text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text' : 'text-gray-300'
                          }`}>
                            {option.count}
                          </div>
                          <div className={`text-sm font-semibold mb-2 transition-colors duration-300 ${
                            num === option.count ? 'text-gray-100' : 'text-gray-400'
                          }`}>
                            {option.label}
                          </div>
                          <div className={`text-xs transition-colors duration-300 ${
                            num === option.count ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {option.desc}
                          </div>
                        </div>
                        {num === option.count && (
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 animate-pulse"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setCurrentStep(2)}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
                      color: '#ffffff',
                      padding: '8px 48px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      border: 'none',
                      boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                      cursor: 'pointer'
                    }}
                  >
                    CONTINUE
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Difficulty Level */}
            {currentStep === 2 && (
              <div className="bg-gray-900 rounded-2xl p-12 shadow-sm border border-white/10 animate-fadeIn">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-semibold text-gray-100 mb-4 tracking-tight">Set Difficulty Level</h2>
                  <p className="text-gray-400 text-lg">Choose the challenge level for your problems</p>
                </div>

                <div className="relative">
                  <div className="relative w-full max-w-lg mx-auto">
                    {/* Track with subtle gradient */}
                    <div className="h-1.5 bg-gradient-to-r from-emerald-900 via-orange-900 to-violet-900 rounded-full relative">
                      {/* Tick marks */}
                      {difficultyCards.map((card, idx) => (
                        <div
                          key={card.id}
                          className={`absolute top-1/2 w-2 h-2 rounded-full transform -translate-y-1/2 transition-all duration-300 ${
                            difficulty === card.id
                              ? 'scale-125 shadow-sm'
                              : ''
                          }`}
                          style={{
                            left: `calc(${idx * 50}% - 4px)`,
                            backgroundColor: difficulty === card.id
                              ? (card.id === 'Easy' ? '#10b981' : card.id === 'Medium' ? '#f97316' : '#a855f7')
                              : '#475569'
                          }}
                        />
                      ))}
                      
                      {/* Slider thumb */}
                      <div
                        className={`absolute top-1/2 w-5 h-5 bg-gray-900 rounded-full shadow-md transform -translate-y-1/2 transition-all duration-300 ease-out border-2 ${
                          difficultyCards.some(card => card.id === difficulty) ? 'scale-110 shadow-lg' : ''
                        }`}
                        style={{
                          left: `calc(${difficultyCards.findIndex(card => card.id === difficulty) * 50}% - 10px)`,
                          borderColor: difficulty === 'Easy' ? '#10b981' :
                                      difficulty === 'Medium' ? '#f97316' : '#a855f7',
                          boxShadow: difficultyCards.some(card => card.id === difficulty)
                            ? `0 4px 16px rgba(0,0,0,0.4), 0 0 0 2px ${difficulty === 'Easy' ? 'rgba(16,185,129,0.25)' :
                                                                         difficulty === 'Medium' ? 'rgba(249,115,22,0.25)' : 'rgba(168,85,247,0.25)'}`
                            : '0 2px 8px rgba(0,0,0,0.3)'
                        }}
                      />
                    </div>

                    {/* Clickable areas */}
                    <div className="flex absolute inset-0 -my-4">
                      {difficultyCards.map((card, idx) => (
                        <div
                          key={card.id}
                          onClick={() => setDifficulty(card.id)}
                          className="flex-1 cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 text-center">
                    <div className={`text-lg font-medium transition-colors duration-300 ${
                      difficulty === 'Easy' ? 'text-emerald-400' :
                      difficulty === 'Medium' ? 'text-orange-400' :
                      'text-violet-400'
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
                    className="p-3 rounded-lg flex items-center justify-center text-gray-300"
                    style={{
                      border: '1px solid #334155',
                      cursor: 'pointer'
                    }}
                  >
                    <BackIcon />
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
                      color: '#ffffff',
                      padding: '8px 48px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      border: 'none',
                      boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                      cursor: 'pointer'
                    }}
                  >
                    CONTINUE
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Topic Selection */}
            {currentStep === 3 && (
              <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/10 animate-slideIn">
                <p className="text-2xl font-medium text-gray-100 mb-8">Choose problem categories to focus on</p>

                {/* Search and Actions */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1 relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search topics..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-800 text-gray-100 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const topics = ['Array', 'LinkedList', 'Tree', 'Graph', 'String', 'DP', 'Stack', 'Queue', 'Matrix', 'Hashing', 'BinarySearch', 'TwoPointers', 'Math', 'Database', 'Other']
                      const randomTopic = topics[Math.floor(Math.random() * topics.length)]
                      setTopic(randomTopic)
                    }}
                    className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-xl transition-all"
                  >
                    Randomize
                  </button>
                </div>

                {(() => {
                  const allTopics = [
                    { id: 'All', label: 'Any Topic', icon: 'All', category: 'Core' },
                    { id: 'Array', label: 'Array', icon: '[]', category: 'Core' },
                    { id: 'String', label: 'String', icon: 'Aa', category: 'Core' },
                    { id: 'LinkedList', label: 'Linked List', icon: '->', category: 'Core' },
                    { id: 'Tree', label: 'Tree', icon: 'T', category: 'Advanced' },
                    { id: 'Graph', label: 'Graph', icon: 'G', category: 'Advanced' },
                    { id: 'DP', label: 'Dynamic Programming', icon: 'DP', category: 'Advanced' },
                    { id: 'BinarySearch', label: 'Binary Search', icon: 'BS', category: 'Advanced' },
                    { id: 'Stack', label: 'Stack', icon: 'S', category: 'Specialized' },
                    { id: 'Queue', label: 'Queue', icon: 'Q', category: 'Specialized' },
                    { id: 'Matrix', label: 'Matrix', icon: 'Mx', category: 'Specialized' },
                    { id: 'Hashing', label: 'Hash/Map', icon: '#', category: 'Specialized' },
                    { id: 'TwoPointers', label: 'Two Pointers', icon: '<>', category: 'Specialized' },
                    { id: 'Math', label: 'Math', icon: '123', category: 'Specialized' },
                    { id: 'Database', label: 'Database', icon: 'DB', category: 'Specialized' },
                    { id: 'Other', label: 'Other', icon: '...', category: 'Specialized' }
                  ]
                  
                  const filteredTopics = allTopics.filter(t => 
                    t.label.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  
                  const groupedTopics = filteredTopics.reduce((acc, topic) => {
                    if (!acc[topic.category]) acc[topic.category] = []
                    acc[topic.category].push(topic)
                    return acc
                  }, {})
                  
                  return Object.entries(groupedTopics).map(([category, topics]) => (
                    <div key={category} className="mb-6">
                      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {topics.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setTopic(t.id)}
                            className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                              topic === t.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 scale-105'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:shadow-md hover:-translate-y-0.5'
                            }`}
                          >
                            <span className="text-xs opacity-75">{t.icon}</span>
                            <span>{t.label}</span>
                            {topic === t.id && (
                              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping"></div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                })()}
                
                <div className="mb-2"></div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="p-3 rounded-lg flex items-center justify-center text-gray-300"
                    style={{
                      border: '1px solid #334155',
                      cursor: 'pointer'
                    }}
                  >
                    <BackIcon />
                  </button>
                  <button
                    onClick={() => setCurrentStep(4)}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
                      color: '#ffffff',
                      padding: '8px 48px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      border: 'none',
                      boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                      cursor: 'pointer'
                    }}
                  >
                    CONTINUE
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Duration */}
            {currentStep === 4 && (
              <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/10 animate-slideIn">
                <p className="text-2xl font-semibold text-gray-100 mb-8">Set contest duration</p>

                <div className="flex flex-col items-center mb-8">
                  <div className="relative w-48 h-48 mb-6">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#334155"
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
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-4xl font-bold text-gray-100">{durationMin}</div>
                      <div className="text-sm text-gray-500 font-medium">minutes</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {durationMin <= 30 ? 'Blitz' : durationMin <= 90 ? 'Standard' : durationMin <= 150 ? 'Extended' : 'Marathon'}
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-md">
                    <div className="relative">
                      <input
                        type="range"
                        min={10}
                        max={240}
                        step={5}
                        value={durationMin}
                        onChange={e => setDurationMin(Number(e.target.value))}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #6366f1 0%, #a855f7 ${((durationMin - 10) / (240 - 10)) * 100}%, #334155 ${((durationMin - 10) / (240 - 10)) * 100}%, #334155 100%)`,
                          WebkitAppearance: 'none',
                          outline: 'none'
                        }}
                      />
                      <style>{`
                        input[type="range"]::-webkit-slider-thumb {
                          -webkit-appearance: none;
                          width: 28px;
                          height: 28px;
                          border-radius: 50%;
                          background: #1e293b;
                          border: 3px solid #6366f1;
                          cursor: pointer;
                          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                        }
                        input[type="range"]::-moz-range-thumb {
                          width: 28px;
                          height: 28px;
                          border-radius: 50%;
                          background: #1e293b;
                          border: 3px solid #6366f1;
                          cursor: pointer;
                          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                          border: none;
                        }
                      `}</style>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-3">
                      <span className="flex flex-col items-center">
                        <span>10m</span>
                        <span className="text-xs text-gray-600">Quick</span>
                      </span>
                      <span className="flex flex-col items-center">
                        <span>120m</span>
                        <span className="text-xs text-gray-600">Standard</span>
                      </span>
                      <span className="flex flex-col items-center">
                        <span>240m</span>
                        <span className="text-xs text-gray-600">Epic</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 text-center">
                    <div className="text-lg font-semibold text-gray-100 mb-3">
                      {durationMin <= 30 ? 'Fast-paced coding sprint' :
                       durationMin <= 90 ? 'Balanced challenge time' :
                       durationMin <= 150 ? 'Extended problem solving' : 'Marathon coding session'}
                    </div>

                    {/* Manual input */}
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-gray-500">Or enter manually:</span>
                      <input
                        type="number"
                        min={10}
                        max={240}
                        value={durationMin}
                        onChange={e => {
                          const val = Math.max(10, Math.min(240, Number(e.target.value) || 10))
                          setDurationMin(val)
                        }}
                        className="w-16 px-2 py-1 text-sm bg-gray-800 text-gray-100 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-center"
                      />
                      <span className="text-sm text-gray-500">min</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="p-3 rounded-lg flex items-center justify-center text-gray-300"
                    style={{
                      border: '1px solid #334155',
                      cursor: 'pointer'
                    }}
                  >
                    <BackIcon />
                  </button>
                  <button
                    onClick={create}
                    disabled={loading}
                    style={{
                      background: loading ? '#475569' : 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
                      color: '#ffffff',
                      padding: '8px 48px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      border: 'none',
                      boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? '0.8' : '1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        CREATING...
                      </>
                    ) : (
                      'CREATE CONTEST'
                    )}
                  </button>
                </div>
              </div>
            )}


            {createdLink && (
              <div className="mt-6 p-4 bg-emerald-500/10 rounded-2xl shadow-lg border border-emerald-500/20 animate-slideIn">
                <div className="text-sm font-medium mb-3 text-emerald-400">
                  Contest created successfully!
                </div>
                <div className="flex gap-3">
                  <input
                    className="flex-1 text-sm bg-transparent text-gray-300"
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

      {showSessions && <Sessions onClose={() => setShowSessions(false)} />}
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
