import React from 'react'

export default function ApiBadge(){
  const api = import.meta.env.VITE_API_BASE || 'https://dsa-duel.onrender.com'
  const isLocal = api.includes('localhost') || api.includes('127.0.0.1')
  return (
    <div style={{position:'fixed', left:12, top:12, zIndex:60}}>
      <div style={{fontSize:12, padding: '6px 8px', borderRadius:8, background: isLocal ? 'var(--warning)' : 'var(--primary)', color: isLocal ? '#111' : '#fff'}}>
        API: {isLocal ? `${api} (local)` : api}
      </div>
    </div>
  )
}
