import React, { useState } from 'react'
import Editor from '@monaco-editor/react'

const LANGUAGES = [
  { key: 'java', label: 'Java', monacoLang: 'java' },
  { key: 'cpp', label: 'C++', monacoLang: 'cpp' }
]

// Same CSS-specificity gotcha as Contest.jsx: a global `button:not(.btn-*)` rule in
// App.css overrides plain Tailwind color classes, so custom button colors here are
// inline styles too, not bg-black/bg-gray-* classes.
const activeTabStyle = { backgroundColor: '#000000', color: '#ffffff', fontWeight: 600 }
const inactiveTabStyle = { backgroundColor: '#f8fafc', color: '#374151', border: '1px solid #d1d5db', fontWeight: 500 }
const disabledActionStyle = { backgroundColor: '#f1f5f9', color: '#9ca3af', border: '1px solid #e2e8f0', fontWeight: 600, cursor: 'not-allowed' }
const disabledPrimaryStyle = { backgroundColor: '#9ca3af', color: '#ffffff', fontWeight: 600, cursor: 'not-allowed', border: 'none' }

export default function CodeEditor({ problem, onClose }) {
  const [language, setLanguage] = useState('java')
  const [codeByLanguage, setCodeByLanguage] = useState(() => ({
    java: problem.codeSnippets?.java || '',
    cpp: problem.codeSnippets?.cpp || ''
  }))

  const handleCodeChange = (value) => {
    setCodeByLanguage((prev) => ({ ...prev, [language]: value ?? '' }))
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{problem.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Run and Submit aren't wired up yet -- coming in the next phase</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-3 border-b border-black/6">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.key}
              onClick={() => setLanguage(lang.key)}
              className="px-3 py-1.5 text-sm rounded-lg"
              style={language === lang.key ? activeTabStyle : inactiveTabStyle}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language={language === 'cpp' ? 'cpp' : 'java'}
            value={codeByLanguage[language]}
            onChange={handleCodeChange}
            theme="vs-light"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true
            }}
          />
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/6">
          <button
            disabled
            title="Judge execution isn't wired up yet -- coming in the next phase"
            className="px-4 py-2 rounded-xl text-sm"
            style={disabledActionStyle}
          >
            Run
          </button>
          <button
            disabled
            title="Judge execution isn't wired up yet -- coming in the next phase"
            className="px-6 py-2 rounded-xl text-sm"
            style={disabledPrimaryStyle}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
