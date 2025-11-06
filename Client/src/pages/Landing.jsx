import React from 'react'

const PlaySVG = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <polygon points="10,8 16,12 10,16" fill="currentColor"/>
  </svg>
)

const ContestIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
)

const TrackingIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="7" cy="16" r="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="16" cy="15" r="2" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
)

const CodeIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 18L22 12L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 6L2 12L8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 4L10 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function Landing({ onNavigate }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-8 py-6 relative z-10 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-gray-900 font-semibold text-xl tracking-tight">DSA DUEL</span>
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
      <div className="flex items-center justify-between px-8 py-20 max-w-7xl mx-auto">
        {/* Left Content */}
        <div className="flex-1 max-w-2xl">
          <h1 className="text-7xl font-bold text-gray-900 leading-tight mb-8 tracking-tight">
            Code that
            <br />
            <span className="text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text">inspires you</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-12 leading-relaxed max-w-xl">
            Master data structures and algorithms through competitive programming. 
            Challenge yourself, compete with others, and build the skills that matter.
          </p>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => onNavigate('signup')}
              style={{
                backgroundColor: '#000000',
                color: '#ffffff',
                padding: '8px 48px',
                borderRadius: '10px',
                fontWeight: '600',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                cursor: 'pointer'
              }}
            >
              Get Started
            </button>
            <button 
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-3 text-gray-700 hover:text-gray-900 font-medium transition-colors group"
            >
              <div className="w-12 h-12 border-2 border-gray-300 group-hover:border-gray-400 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105">
                <PlaySVG size={20} />
              </div>
              <span className="text-lg">Watch Demo</span>
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
      <div id="features" className="px-8 py-24 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">Everything you need to excel</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">Powerful tools and features designed to accelerate your coding journey</p>
        </div>
        <style jsx>{`
          @keyframes float1 {
            0%, 100% { transform: rotateY(-2deg) rotateX(1deg); }
            50% { transform: rotateY(2deg) rotateX(-1deg); }
          }
          @keyframes float2 {
            0%, 100% { transform: rotateY(1deg) rotateX(-2deg); }
            50% { transform: rotateY(-1deg) rotateX(2deg); }
          }
          @keyframes float3 {
            0%, 100% { transform: rotateY(-1deg) rotateX(2deg); }
            50% { transform: rotateY(1deg) rotateX(-1deg); }
          }
          .float-1 { animation: float1 6s ease-in-out infinite; }
          .float-2 { animation: float2 7s ease-in-out infinite; }
          .float-3 { animation: float3 8s ease-in-out infinite; }
          .float-1:hover, .float-2:hover, .float-3:hover { animation-play-state: paused; }
        `}</style>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Real-time Contests Card */}
          <div className="group w-full h-64 mx-auto [perspective:1000px] cursor-pointer p-1 rounded-2xl bg-gradient-to-br from-blue-50/20 to-indigo-50/30 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 transition-shadow duration-300">
            <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-white to-blue-50/30 border border-gray-100 shadow-sm p-8">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                  <ContestIcon size={28} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 text-center mb-3">Real-time Contests</h3>
                <p className="text-sm text-gray-600 text-center leading-relaxed">Hover to learn more</p>
              </div>
              {/* Back Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center rounded-2xl bg-gradient-to-br from-gray-600 to-gray-700 text-white [transform:rotateY(180deg)] p-8">
                <p className="text-center text-base font-medium leading-relaxed">Live coding competitions with global developers</p>
              </div>
            </div>
          </div>

          {/* Skill Tracking Card */}
          <div className="group w-full h-64 mx-auto [perspective:1000px] cursor-pointer p-1 rounded-2xl bg-gradient-to-br from-emerald-50/20 to-teal-50/30 shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20 transition-shadow duration-300">
            <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-white to-emerald-50/30 border border-gray-100 shadow-sm p-8">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-50 to-teal-100 rounded-2xl flex items-center justify-center mb-6">
                  <TrackingIcon size={28} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 text-center mb-3">Skill Tracking</h3>
                <p className="text-sm text-gray-600 text-center leading-relaxed">Hover to learn more</p>
              </div>
              {/* Back Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-slate-600 text-white [transform:rotateY(180deg)] p-8">
                <p className="text-center text-base font-medium leading-relaxed">Track progress and climb global rankings</p>
              </div>
            </div>
          </div>

          {/* LeetCode Integration Card */}
          <div className="group w-full h-64 mx-auto [perspective:1000px] cursor-pointer p-1 rounded-2xl bg-gradient-to-br from-purple-50/20 to-violet-50/30 shadow-lg shadow-purple-500/10 hover:shadow-xl hover:shadow-purple-500/20 transition-shadow duration-300">
            <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-white to-purple-50/30 border border-gray-100 shadow-sm p-8">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl flex items-center justify-center mb-6">
                  <CodeIcon size={28} className="text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 text-center mb-3">LeetCode Integration</h3>
                <p className="text-sm text-gray-600 text-center leading-relaxed">Hover to learn more</p>
              </div>
              {/* Back Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-500 to-zinc-600 text-white [transform:rotateY(180deg)] p-8">
                <p className="text-center text-base font-medium leading-relaxed">Curated coding challenges and solutions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-gray-50 to-gray-100 border-t border-gray-200/50 py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">D</span>
              </div>
              <span className="text-gray-900 font-semibold text-xl tracking-tight">DSA DUEL</span>
            </div>
            <p className="text-gray-600 text-sm">© 2024 DSA Duel. Crafted with precision.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}