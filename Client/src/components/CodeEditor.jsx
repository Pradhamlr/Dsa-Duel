import React, { useState } from 'react'
import Editor from '@monaco-editor/react'
import { runCode, submitCode } from '../utils/api'

const LANGUAGES = [
  { key: 'java', label: 'Java', monacoLang: 'java', judgeReady: true },
  { key: 'cpp', label: 'C++', monacoLang: 'cpp', judgeReady: false }
]

// Same CSS-specificity gotcha as Contest.jsx: a global `button:not(.btn-*)` rule in
// App.css overrides plain Tailwind color classes, so custom button colors here are
// inline styles too, not bg-black/bg-gray-* classes.
const activeTabStyle = { backgroundColor: '#000000', color: '#ffffff', fontWeight: 600 }
const inactiveTabStyle = { backgroundColor: '#f8fafc', color: '#374151', border: '1px solid #d1d5db', fontWeight: 500 }
const disabledActionStyle = { backgroundColor: '#f1f5f9', color: '#9ca3af', border: '1px solid #e2e8f0', fontWeight: 600, cursor: 'not-allowed' }
const disabledPrimaryStyle = { backgroundColor: '#9ca3af', color: '#ffffff', fontWeight: 600, cursor: 'not-allowed', border: 'none' }
const actionStyle = { backgroundColor: '#f8fafc', color: '#374151', border: '1px solid #d1d5db', fontWeight: 600, cursor: 'pointer' }
const primaryStyle = { backgroundColor: '#000000', color: '#ffffff', fontWeight: 600, cursor: 'pointer', border: 'none' }

export default function CodeEditor({ problem, contestId, problemIndex, onClose, onSolved }) {
  const [language, setLanguage] = useState('java')
  const [codeByLanguage, setCodeByLanguage] = useState(() => ({
    java: problem.codeSnippets?.java || '',
    cpp: problem.codeSnippets?.cpp || ''
  }))
  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [verdict, setVerdict] = useState(null)
  const [testResults, setTestResults] = useState(null)
  const [actionError, setActionError] = useState('')

  const judgeReady = LANGUAGES.find((l) => l.key === language)?.judgeReady
  const busy = running || submitting

  const handleCodeChange = (value) => {
    setCodeByLanguage((prev) => ({ ...prev, [language]: value ?? '' }))
  }

  const handleRun = async () => {
    setRunning(true)
    setActionError('')
    setVerdict(null)
    try {
      const data = await runCode(contestId, problemIndex, language, codeByLanguage[language])
      setVerdict(data.verdict)
      setTestResults(data.testResults || null)
    } catch (err) {
      setActionError(err.message || 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setActionError('')
    setVerdict(null)
    try {
      const data = await submitCode(contestId, problemIndex, language, codeByLanguage[language])
      setVerdict(data.verdict)
      setTestResults(data.testResults || null)
      if (data.verdict === 'accepted' && data.contest && onSolved) {
        onSolved(data.contest)
      }
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: data.verdict === 'accepted' ? 'Accepted!' : `Verdict: ${data.verdict}`,
          type: data.verdict === 'accepted' ? 'success' : 'warning'
        }
      }))
    } catch (err) {
      setActionError(err.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
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
            {!judgeReady && (
              <p className="text-xs text-gray-500 mt-0.5">C++ execution isn't wired up yet -- try Java for now</p>
            )}
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
              onClick={() => { setLanguage(lang.key); setVerdict(null); setTestResults(null); setActionError('') }}
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

        {(verdict || actionError || testResults) && (
          <div className="px-6 py-3 border-t border-black/6 max-h-48 overflow-y-auto">
            {actionError && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-2">
                {actionError}
              </div>
            )}
            {verdict && (
              <div className={`text-sm font-semibold mb-2 ${verdict === 'accepted' ? 'text-emerald-700' : 'text-amber-700'}`}>
                Verdict: {verdict}
              </div>
            )}
            {Array.isArray(testResults) && testResults.map((t, i) => (
              <div key={i} className={`text-xs rounded-lg px-3 py-2 mb-1.5 border ${t.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                <div className="font-semibold">Test case {i + 1}: {t.passed ? 'Passed' : 'Failed'}</div>
                {!t.passed && (
                  <div className="mt-1 space-y-0.5">
                    <div>Input: {JSON.stringify(t.input)}</div>
                    <div>Expected: {JSON.stringify(t.expectedOutput)}</div>
                    {t.error ? <div>Error: {t.error}</div> : <div>Got: {JSON.stringify(t.actualOutput)}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/6">
          <button
            onClick={judgeReady ? handleRun : undefined}
            disabled={!judgeReady || busy}
            title={judgeReady ? 'Run against the visible examples' : "C++ execution isn't wired up yet"}
            className="px-4 py-2 rounded-xl text-sm"
            style={!judgeReady || busy ? disabledActionStyle : actionStyle}
          >
            {running ? 'Running...' : 'Run'}
          </button>
          <button
            onClick={judgeReady ? handleSubmit : undefined}
            disabled={!judgeReady || busy}
            title={judgeReady ? 'Run and mark solved on a full pass' : "C++ execution isn't wired up yet"}
            className="px-6 py-2 rounded-xl text-sm"
            style={!judgeReady || busy ? disabledPrimaryStyle : primaryStyle}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
