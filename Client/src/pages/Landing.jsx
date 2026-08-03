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
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/20 to-purple-950/10">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-8 py-6 relative z-10 bg-gray-900/80 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-gray-100 font-semibold text-xl tracking-tight">DSA DUEL</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-500 font-medium ml-20">
          <button type="button" aria-label="Home">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 7.609c.352 0 .69.122.96.343l.111.1 6.25 6.25v.001a1.5 1.5 0 0 1 .445 1.071v7.5a.89.89 0 0 1-.891.891H9.125a.89.89 0 0 1-.89-.89v-7.5l.006-.149a1.5 1.5 0 0 1 .337-.813l.1-.11 6.25-6.25c.285-.285.67-.444 1.072-.444Zm5.984 7.876L16 9.5l-5.984 5.985v6.499h11.968z" fill="#94a3b8" stroke="#94a3b8" strokeWidth=".094"/>
            </svg>
          </button>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m14.413 10.663-6.25 6.25a.939.939 0 1 1-1.328-1.328L12.42 10 6.836 4.413a.939.939 0 1 1 1.328-1.328l6.25 6.25a.94.94 0 0 1-.001 1.328" fill="#475569"/>
          </svg>
          <span className="text-indigo-400 font-semibold">Home</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('login')}
            style={{
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              padding: '6px 12px',
              border: '1px solid #334155',
              borderRadius: 8,
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
            LOGIN
          </button>
          <button
            onClick={() => onNavigate('signup')}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
              color: '#ffffff',
              padding: '6px 12px',
              border: 'none',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              fontSize: '0.875rem',
              fontWeight: '500',
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
          <h1 className="text-7xl font-bold text-gray-100 leading-tight mb-8 tracking-tight">
            Code that
            <br />
            <span className="text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text">inspires you</span>
          </h1>

          <p className="text-xl text-gray-400 mb-12 leading-relaxed max-w-xl">
            Master data structures and algorithms through competitive programming.
            Challenge yourself, compete with others, and build the skills that matter.
          </p>

          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('signup')}
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
              Get Started
            </button>
            <button
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-3 text-gray-300 hover:text-gray-100 font-medium transition-colors group"
            >
              <div className="w-12 h-12 border-2 border-gray-700 group-hover:border-gray-600 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105">
                <PlaySVG size={20} />
              </div>
              <span className="text-lg">Watch Demo</span>
            </button>
          </div>
        </div>

        {/* Right Visual Element -- a static, decorative code-editor mockup (not a real
            Monaco instance; this is a pre-login marketing page, so a plain HTML/CSS
            visual keeps it lightweight rather than loading the real editor bundle just
            for show). A rotated card peeks out behind it for the same "stacked cards"
            depth the rest of this hero already leans on. */}
        <div className="flex-1 flex justify-end">
          <div className="relative w-[420px]">
            <div className="absolute -top-4 -right-4 w-full h-full bg-gradient-to-br from-indigo-600/30 to-purple-600/30 rounded-2xl transform rotate-3 border border-white/10"></div>

            <div className="relative bg-gray-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform -rotate-1">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 border-b border-white/10">
                <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
                <span className="ml-3 text-xs text-gray-500 font-mono">solution.cpp</span>
              </div>

              {/* Code body */}
              <div className="p-5 font-mono text-[13px] leading-relaxed">
                <div><span className="text-purple-400">#include</span> <span className="text-emerald-400">&lt;iostream&gt;</span></div>
                <div><span className="text-purple-400">#include</span> <span className="text-emerald-400">&lt;vector&gt;</span></div>
                <div className="h-4"></div>
                <div><span className="text-purple-400">using namespace</span> <span className="text-gray-300">std;</span></div>
                <div className="h-4"></div>
                <div><span className="text-indigo-400">int</span> <span className="text-blue-300">main</span><span className="text-gray-400">() {'{'}</span></div>
                <div className="pl-4 text-gray-500">// Optimize for competitive execution</div>
                <div className="pl-4"><span className="text-indigo-400">ios_base::sync_with_stdio</span><span className="text-gray-400">(</span><span className="text-orange-400">false</span><span className="text-gray-400">);</span></div>
                <div className="pl-4"><span className="text-gray-300">cin.tie</span><span className="text-gray-400">(</span><span className="text-orange-400">NULL</span><span className="text-gray-400">);</span></div>
                <div className="h-4"></div>
                <div className="pl-4"><span className="text-indigo-400">int</span> <span className="text-gray-300">t;</span></div>
                <div className="pl-4"><span className="text-gray-300">cin</span> <span className="text-gray-400">{'>>'}</span> <span className="text-gray-300">t;</span></div>
                <div className="pl-4"><span className="text-purple-400">while</span> <span className="text-gray-400">(t--) {'{'}</span></div>
                <div className="pl-8"><span className="text-indigo-400">int</span> <span className="text-gray-300">n;</span></div>
                <div className="pl-8"><span className="text-gray-300">cin</span> <span className="text-gray-400">{'>>'}</span> <span className="text-gray-300">n;</span></div>
                <div className="pl-8"><span className="text-indigo-400">vector</span><span className="text-gray-400">{'<int>'}</span> <span className="text-gray-300">a(n);</span></div>
                <div className="pl-8 bg-indigo-500/10 -mx-5 px-5 rounded"><span className="text-purple-400">for</span> <span className="text-gray-400">(</span><span className="text-indigo-400">int</span><span className="text-gray-400">&amp;</span> <span className="text-gray-300">i : a) cin {'>>'} i;</span></div>
                <div className="pl-8"><span className="text-gray-300">cout</span> <span className="text-gray-400">{'<<'}</span> <span className="text-blue-300">solve</span><span className="text-gray-400">(a)</span> <span className="text-gray-400">{'<<'}</span> <span className="text-emerald-400">"\n"</span><span className="text-gray-400">;</span></div>
                <div className="pl-4 text-gray-400">{'}'}</div>
                <div className="pl-4"><span className="text-purple-400">return</span> <span className="text-orange-400">0</span><span className="text-gray-400">;</span></div>
                <div className="text-gray-400">{'}'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="px-8 py-24 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-100 mb-4 tracking-tight">Everything you need to excel</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">Powerful tools and features designed to accelerate your coding journey</p>
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
          <div className="group w-full h-64 mx-auto [perspective:1000px] cursor-pointer p-1 rounded-2xl bg-gradient-to-br from-blue-500/5 to-indigo-500/10 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 transition-shadow duration-300">
            <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center rounded-2xl bg-gray-900 border border-white/10 shadow-sm p-8">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500/10 to-indigo-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <ContestIcon size={28} className="text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-100 text-center mb-3">Real-time Contests</h3>
                <p className="text-sm text-gray-400 text-center leading-relaxed">Hover to learn more</p>
              </div>
              {/* Back Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 text-white [transform:rotateY(180deg)] p-8">
                <p className="text-center text-base font-medium leading-relaxed">Live coding competitions with global developers</p>
              </div>
            </div>
          </div>

          {/* Skill Tracking Card */}
          <div className="group w-full h-64 mx-auto [perspective:1000px] cursor-pointer p-1 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-teal-500/10 shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20 transition-shadow duration-300">
            <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center rounded-2xl bg-gray-900 border border-white/10 shadow-sm p-8">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500/10 to-teal-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <TrackingIcon size={28} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-100 text-center mb-3">Skill Tracking</h3>
                <p className="text-sm text-gray-400 text-center leading-relaxed">Hover to learn more</p>
              </div>
              {/* Back Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 text-white [transform:rotateY(180deg)] p-8">
                <p className="text-center text-base font-medium leading-relaxed">Track progress and climb global rankings</p>
              </div>
            </div>
          </div>

          {/* LeetCode Integration Card */}
          <div className="group w-full h-64 mx-auto [perspective:1000px] cursor-pointer p-1 rounded-2xl bg-gradient-to-br from-purple-500/5 to-violet-500/10 shadow-lg shadow-purple-500/10 hover:shadow-xl hover:shadow-purple-500/20 transition-shadow duration-300">
            <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex flex-col items-center justify-center rounded-2xl bg-gray-900 border border-white/10 shadow-sm p-8">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500/10 to-violet-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <CodeIcon size={28} className="text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-100 text-center mb-3">LeetCode Integration</h3>
                <p className="text-sm text-gray-400 text-center leading-relaxed">Hover to learn more</p>
              </div>
              {/* Back Side */}
              <div className="absolute w-full h-full [backface-visibility:hidden] flex items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-600 to-zinc-700 text-white [transform:rotateY(180deg)] p-8">
                <p className="text-center text-base font-medium leading-relaxed">Curated coding challenges and solutions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-gray-900 to-gray-950 border-t border-white/10 py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">D</span>
              </div>
              <span className="text-gray-100 font-semibold text-xl tracking-tight">DSA DUEL</span>
            </div>
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} DSA Duel. Crafted with precision.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}