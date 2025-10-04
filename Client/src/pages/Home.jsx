import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

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

        <button onClick={create} disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded">
          {loading ? 'Creating...' : 'Create & Get Link'}
        </button>

        <p className="mt-3 text-sm text-gray-600">Share the contest link with your friend.</p>

        {createdLink && (
          <div className="mt-3 p-3 bg-gray-50 border rounded">
            <div className="text-sm mb-2">Contest created — shareable link:</div>
            <div className="flex gap-2">
              <input className="flex-1 p-2 border rounded" value={createdLink} readOnly />
              <button onClick={()=>navigator.clipboard.writeText(createdLink)} className="px-3 py-1 bg-blue-600 text-white rounded">Copy</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}