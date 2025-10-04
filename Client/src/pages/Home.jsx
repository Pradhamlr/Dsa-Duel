import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'

// Use production backend by default if VITE_API_BASE is not set
const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

export default function Home(){
  const [num, setNum] = useState(5)
  const [difficulty, setDifficulty] = useState('mixed')
  const [durationMin, setDurationMin] = useState(90)
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem('duel_name') || '' } catch { return '' }
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [createdLink, setCreatedLink] = useState('')

  async function create(){
    try {
      setLoading(true)
      // ensure user id exists
      let userId = null
      try {
        userId = localStorage.getItem('duel_userId')
        if (!userId) {
          userId = Math.random().toString(36).slice(2,9)
          localStorage.setItem('duel_userId', userId)
        }
      } catch (err) {
        userId = Math.random().toString(36).slice(2,9)
      }
      // persist display name
      try { localStorage.setItem('duel_name', displayName || '') } catch (e) {}

      const res = await fetch(`${API}/create-contest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numProblems: Number(num), difficulty, duration: Number(durationMin) * 60, creatorId: userId, creatorName: displayName })
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">DSA Duel — Create Contest</h1>
        <label className="block mb-2">Number of problems (3-5)</label>
        <input type="number" min={3} max={5} value={num} onChange={e=>setNum(e.target.value)} className="w-full p-2 border rounded mb-3" />

        <label className="block mb-2">Difficulty</label>
        <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="w-full p-2 border rounded mb-4">
          <option value="mixed">Mixed (Easy + Medium)</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
        </select>

        <label className="block mb-2">Duration (minutes)</label>
        <input type="number" min={10} max={240} value={durationMin} onChange={e=>setDurationMin(e.target.value)} className="w-full p-2 border rounded mb-3" />

  <label className="block mb-2">Your name (optional)</label>
  <input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Anonymous" className="w-full p-2 border rounded mb-3" />

        <button onClick={create} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-lg shadow-md hover:shadow-lg transition">
          {loading ? 'Creating contest...' : 'Create & Get Link'}
        </button>


        {createdLink && (
          <div className="mt-3 p-3 bg-gray-50 border rounded">
            <div className="text-sm mb-2">Contest created — shareable link:</div>
            <div className="flex gap-2">
              <input className="flex-1 p-2 border rounded" value={createdLink} readOnly />
              <button onClick={async ()=>{ await navigator.clipboard.writeText(createdLink); window.dispatchEvent(new CustomEvent('show-toast',{detail:{message:'Link copied!', type:'success'}})) }} className="px-3 py-1 bg-blue-600 text-white rounded">Copy</button>
            </div>
          </div>
        )}
        <Toast />
        {loading && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center gap-3">
              <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <div className="text-lg font-medium">Preparing your contest…</div>
              <div className="text-sm text-gray-600">This may take a few seconds ANNA.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}