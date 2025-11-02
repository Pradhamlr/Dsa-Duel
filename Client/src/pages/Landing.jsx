import React from 'react'

const PlaySVG = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <polygon points="10,8 16,12 10,16" fill="currentColor"/>
  </svg>
)

export default function Landing({ onNavigate }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="flex justify-between items-center p-6 relative z-10 shadow-sm border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-gray-900 font-semibold text-lg">DSA DUEL</span>
        </div>
        
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-500 font-medium ml-20">
          <button type="button" aria-label="Home">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 7.609c.352 0 .69.122.96.343l.111.1 6.25 6.25v.001a1.5 1.5 0 0 1 .445 1.071v7.5a.89.89 0 0 1-.891.891H9.125a.89.89 0 0 1-.89-.89v-7.5l.006-.149a1.5 1.5 0 0 1 .337-.813l.1-.11 6.25-6.25c.285-.285.67-.444 1.072-.444Zm5.984 7.876L16 9.5l-5.984 5.985v6.499h11.968z" fill="#475569" stroke="#475569" strokeWidth=".094"/>
            </svg>
          </button>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m14.413 10.663-6.25 6.25a.939.939 0 1 1-1.328-1.328L12.42 10 6.836 4.413a.939.939 0 1 1 1.328-1.328l6.25 6.25a.94.94 0 0 1-.001 1.328" fill="#CBD5E1"/>
          </svg>
          <span className="text-indigo-500 font-semibold">Home</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('login')}
            style={{
              backgroundColor: '#f8fafc',
              color: '#374151',
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
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
            LOGIN
          </button>
          <button 
            onClick={() => onNavigate('signup')}
            style={{
              backgroundColor: '#ffffff',
              color: '#111827',
              padding: '6px 12px',
              border: '2px solid #000000',
              borderRadius: 8,
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              fontSize: '0.875rem',
              fontWeight: '500',
              outline: '2px solid rgba(0,0,0,0.95)',
              outlineOffset: 2,
              cursor: 'pointer'
            }}
          >
            JOIN NOW
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex items-center justify-between px-6 py-12 max-w-7xl mx-auto">
        {/* Left Content */}
        <div className="flex-1 max-w-2xl">
          <h1 className="text-6xl font-bold text-gray-900 leading-tight mb-6">
            Code that
            <br />
            <span className="text-indigo-600">inspires you</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Master data structures and algorithms through competitive programming. 
            Challenge yourself, compete with others, and build the skills that matter.
          </p>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-3 text-gray-700 hover:text-gray-900 font-medium transition-colors group"
            >
              <div className="w-12 h-12 border-2 border-gray-300 group-hover:border-gray-400 rounded-full flex items-center justify-center transition-colors">
                <PlaySVG size={20} />
              </div>
              <span className="text-lg">DISCOVER</span>
            </button>
          </div>
        </div>

        {/* Right Visual Element */}
        <div className="flex-1 flex justify-end">
          <div className="relative">
            {/* Abstract geometric shapes inspired by the reference */}
            <div className="w-96 h-96 relative">
              {/* Main building-like structure */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-white to-gray-100 rounded-3xl shadow-2xl transform rotate-3">
                {/* Layered sections */}
                <div className="absolute top-8 left-8 right-8 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl opacity-90"></div>
                <div className="absolute top-28 left-12 right-4 h-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl"></div>
                <div className="absolute top-52 left-4 right-12 h-24 bg-gradient-to-r from-indigo-100 to-blue-200 rounded-2xl"></div>
                
                {/* Accent elements */}
                <div className="absolute bottom-8 left-8 w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl opacity-80"></div>
                <div className="absolute top-16 right-4 w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg opacity-70"></div>
              </div>
              
              {/* Floating accent shapes */}
              <div className="absolute -top-4 left-8 w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl opacity-60 transform -rotate-12"></div>
              <div className="absolute bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl opacity-50 transform rotate-45"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="px-6 py-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Real-time Contests Card */}
          <div className="group h-64 [perspective:1000px] cursor-pointer">
            <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 shadow-lg">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-200 to-indigo-300 rounded-2xl flex items-center justify-center mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg shadow-sm"></div>
                </div>
                <h3 className="text-xl font-semibold text-indigo-900 text-center">Real-time Contests</h3>
              </div>
              {/* Back Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-500 text-white [transform:rotateY(180deg)] p-8">
                <p className="text-center text-lg font-semibold italic leading-loose tracking-wider">Compete with developers worldwide in live coding challenges</p>
              </div>
            </div>
          </div>

          {/* Skill Tracking Card */}
          <div className="group h-64 [perspective:1000px] cursor-pointer">
            <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200 shadow-lg">
                <div className="w-16 h-16 bg-gradient-to-br from-green-200 to-green-300 rounded-2xl flex items-center justify-center mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-700 rounded-lg shadow-sm"></div>
                </div>
                <h3 className="text-xl font-semibold text-green-900 text-center">Skill Tracking</h3>
              </div>
              {/* Back Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center rounded-2xl bg-gradient-to-br from-green-400 to-green-500 text-white [transform:rotateY(180deg)] p-8">
                <p className="text-center text-lg font-semibold italic leading-loose tracking-wider">Monitor your progress and climb the global leaderboard</p>
              </div>
            </div>
          </div>

          {/* LeetCode Integration Card */}
          <div className="group h-64 [perspective:1000px] cursor-pointer">
            <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 shadow-lg">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-200 to-purple-300 rounded-2xl flex items-center justify-center mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg shadow-sm"></div>
                </div>
                <h3 className="text-xl font-semibold text-purple-900 text-center">LeetCode Integration</h3>
              </div>
              {/* Back Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-400 to-purple-500 text-white [transform:rotateY(180deg)] p-8">
                <p className="text-center text-lg font-semibold italic leading-loose tracking-wider">Practice with curated problems from LeetCode platform</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}