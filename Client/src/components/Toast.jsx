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

  const getToastConfig = (type) => {
    switch (type) {
      case 'success':
        return {
          className: 'bg-green-500 text-white border-green-400',
          bgGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        }
      case 'error':
        return {
          className: 'bg-red-500 text-white border-red-400',
          bgGradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
        }
      case 'warning':
        return {
          className: 'bg-yellow-500 text-white border-yellow-400',
          bgGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
        }
      default:
        return {
          className: 'bg-blue-500 text-white border-blue-400',
          bgGradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
        }
    }
  }

  const config = getToastConfig(toast.type)

  return (
    <div 
      aria-live="polite" 
      className="fixed right-6 bottom-6 z-50 animate-slideIn"
    >
      <div 
        className="px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm border font-semibold min-w-[200px] max-w-[400px]"
        style={{
          background: config.bgGradient,
          boxShadow: '0 10px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)'
        }}
      >
        <span>{toast.message}</span>
      </div>
    </div>
  )
}
