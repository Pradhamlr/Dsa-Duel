import React from 'react'

const PlaySVG = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <polygon points="10,8 16,12 10,16" fill="currentColor"/>
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

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('login')}
            style={{
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              padding: '8px 20px',
              border: '1px solid #334155',
              borderRadius: 9999,
              fontSize: '0.875rem',
              fontWeight: '600',
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
            Log In
          </button>
          <button
            onClick={() => onNavigate('signup')}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)',
              color: '#ffffff',
              padding: '8px 20px',
              border: 'none',
              borderRadius: 9999,
              boxShadow: '0 2px 10px rgba(99,102,241,0.18)',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Join Now
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
                boxShadow: '0 2px 10px rgba(99,102,241,0.18)',
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

      {/* Left plain/empty on purpose -- "Watch Demo" will eventually redirect to a
          real demo instead of scrolling here; id="features" kept as a harmless anchor
          in the meantime so the existing scrollIntoView call doesn't break. */}
      <div id="features"></div>
    </div>
  )
}