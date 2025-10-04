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

  const bg = toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'

  return (
    <div aria-live="polite" className="fixed bottom-6 right-6 z-50">
      <div className={`text-white ${bg} px-4 py-2 rounded shadow-lg font-medium`}>{toast.message}</div>
    </div>
  )
}
