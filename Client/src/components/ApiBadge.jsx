import React from 'react'

export default function ApiBadge(){
  const api = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'
  const isLocal = api.includes('localhost') || api.includes('127.0.0.1')
  return (
    <div style={{position:'fixed', left:12, top:12, zIndex:60}}>
      <div className={`text-xs px-2 py-1 rounded ${isLocal ? 'bg-yellow-400 text-black' : 'bg-green-600 text-white'}`}>
        API: {isLocal ? `${api} (local)` : api}
      </div>
    </div>
  )
}
