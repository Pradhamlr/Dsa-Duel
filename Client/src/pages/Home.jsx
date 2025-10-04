import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'

// Use production backend by default if VITE_API_BASE is not set
const API = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'

export default function Home(){
  const [num, setNum] = useState(5)
  const [difficulty, setDifficulty] = useState('mixed')
  const [durationMin, setDurationMin] = useState(90)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [createdLink, setCreatedLink] = useState('')

  async function create(){
    setLoading(true)
    const res = await fetch(`${API}/create-contest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numProblems: Number(num), difficulty, duration: Number(durationMin) * 60 })
    })
    const data = await res.json()
    setLoading(false)
    if (data.contestId) {
      const url = `${window.location.origin}/contest/${data.contestId}`
      setCreatedLink(url)
      // navigate to contest page as well
      navigate(`/contest/${data.contestId}`)
    }
    else alert('failed')
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

        <button onClick={create} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-lg shadow-md hover:shadow-lg transition">
          {loading ? 'Creating contest...' : 'Create & Get Link'}
        </button>

        <p className="mt-3 text-sm text-gray-600">Share the contest link with ANNANMAR.</p>

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