import React from 'react'

export default function Card({ 
  children, 
  className = '', 
  hover = true, 
  padding = 'md',
  gradient = false,
  ...props 
}) {
  const baseClasses = 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-lg transition-all duration-300'
  
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6', 
    lg: 'p-8'
  }
  
  const hoverClasses = hover ? 'hover:shadow-2xl hover:-translate-y-1 hover:border-blue-300/50 dark:hover:border-blue-600/50' : ''
  
  const gradientClasses = gradient ? 'bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-800 dark:via-blue-900/20 dark:to-purple-900/20' : ''
  
  const classes = `${baseClasses} ${paddingClasses[padding]} ${hoverClasses} ${gradientClasses} ${className}`
  
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}