import React, { useEffect, useState } from 'react'

// Simple window-event based toast. Dispatch a custom event:
// window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Copied!', type: 'success' } }))
export default function Toast(){
  const [toast, setToast] = useState(null)

  useEffect(()=>{
    let timer = null
    function onShow(e){
      const { message, type } = e.detail || {}
      setToast({ message: message || '', type: type || 'info' })
      clearTimeout(timer)
      timer = setTimeout(()=> setToast(null), 3000)
    }

    window.addEventListener('show-toast', onShow)
    return () => {
      window.removeEventListener('show-toast', onShow)
      clearTimeout(timer)
    }
  }, [])

  if (!toast) return null

  const bgStyle = toast.type === 'success'
    ? { background: 'var(--primary)', color: 'white' }
    : toast.type === 'error'
    ? { background: 'var(--danger)', color: 'white' }
    : { background: 'var(--toast-info-bg)', color: 'var(--toast-info-color)' }

  return (
    <div aria-live="polite" style={{position:'fixed', right:24, bottom:24, zIndex: 9999}}>
      <div style={{ padding: '8px 14px', borderRadius: 10, boxShadow: '0 6px 18px rgba(2,6,23,0.35)', fontWeight:600, ...bgStyle }}>{toast.message}</div>
    </div>
  )
}
