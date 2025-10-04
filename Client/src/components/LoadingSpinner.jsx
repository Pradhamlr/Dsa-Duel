import React from 'react'

export default function LoadingSpinner({ size = 'md', message, className = '' }) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10', 
    lg: 'h-16 w-16'
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative">
        <div className={`animate-spin ${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full`}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`${size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-4 w-4' : 'h-6 w-6'} bg-blue-600 rounded-full animate-pulse`}></div>
        </div>
      </div>
      {message && (
        <div className="text-center">
          <div className="font-medium text-sm sm:text-base">{message}</div>
        </div>
      )}
    </div>
  )
}