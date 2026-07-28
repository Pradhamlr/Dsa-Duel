import React, { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import DOMPurify from 'dompurify'
import { runCode, submitCode, getProblemDetails } from '../utils/api'

const LANGUAGES = [
  { key: 'java', label: 'Java', monacoLang: 'java', judgeReady: true },
  { key: 'cpp', label: 'C++', monacoLang: 'cpp', judgeReady: false }
]

const DIFFICULTY_STYLES = {
  Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hard: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
}

const ArrowUpRightSVG = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// Same CSS-specificity gotcha as Contest.jsx: a global `button:not(.btn-*)` rule in
// App.css overrides plain Tailwind color classes, so custom button colors here are
// inline styles too, not bg-black/bg-gray-* classes.
const activeTabStyle = { background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)', color: '#ffffff', fontWeight: 600 }
const inactiveTabStyle = { backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', fontWeight: 500 }
const disabledActionStyle = { backgroundColor: '#1e293b', color: '#64748b', border: '1px solid #334155', fontWeight: 600, cursor: 'not-allowed' }
const disabledPrimaryStyle = { backgroundColor: '#475569', color: '#ffffff', fontWeight: 600, cursor: 'not-allowed', border: 'none' }
const actionStyle = { backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', fontWeight: 600, cursor: 'pointer' }
const primaryStyle = { background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)', color: '#ffffff', fontWeight: 600, cursor: 'pointer', border: 'none', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }

const formatExampleInput = (input) => {
  if (!input || typeof input !== 'object') return String(input)
  return Object.entries(input).map(([key, value]) => `${key} = ${JSON.stringify(value)}`).join(', ')
}

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

  const [details, setDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(true)
  const [detailsError, setDetailsError] = useState('')

  useEffect(() => {
    let cancelled = false
    setDetailsLoading(true)
    setDetailsError('')
    getProblemDetails(contestId, problemIndex)
      .then((data) => { if (!cancelled) setDetails(data) })
      .catch((err) => { if (!cancelled) setDetailsError(err.message || 'Failed to load problem details') })
      .finally(() => { if (!cancelled) setDetailsLoading(false) })
    return () => { cancelled = true }
  }, [contestId, problemIndex])

  const judgeReady = LANGUAGES.find((l) => l.key === language)?.judgeReady
  const busy = running || submitting
  const judgeSupported = !!problem.judgeSupported

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

  const sanitizedDescription = details?.description ? DOMPurify.sanitize(details.description) : null
  const examples = Array.isArray(details?.testCases) ? details.testCases : []
  const difficultyLabel = details?.difficulty || problem.difficulty
  const difficultyStyle = DIFFICULTY_STYLES[difficultyLabel] || DIFFICULTY_STYLES.Medium
  const tags = details?.finalTags || problem.finalTags || []

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="min-w-0 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-100 truncate">{problem.title}</h2>
            {difficultyLabel && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${difficultyStyle}`}>
                {difficultyLabel}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 flex-shrink-0" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Description pane */}
          <div className="w-full lg:w-[42%] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 overflow-y-auto px-6 py-5">
            {detailsLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-500 text-sm gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-indigo-900 border-t-indigo-500 rounded-full"></div>
                Loading problem details...
              </div>
            ) : detailsError ? (
              <div className="text-sm text-rose-400">{detailsError}</div>
            ) : (
              <>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tags.map((tag) => (
                      <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-800 text-gray-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {sanitizedDescription ? (
                  <div
                    className="prose prose-sm prose-invert max-w-none text-gray-300 leading-relaxed [&_p]:mb-3 [&_pre]:bg-gray-800 [&_pre]:border [&_pre]:border-gray-700 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:text-[13px]"
                    dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                  />
                ) : (
                  <div className="text-sm text-gray-500">No description available for this problem yet.</div>
                )}

                {examples.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-100">Examples</h3>
                    {examples.map((ex, i) => (
                      <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-xs font-mono text-gray-300 space-y-1">
                        <div className="font-semibold text-gray-500 font-sans">Example {i + 1}</div>
                        <div><span className="font-semibold">Input:</span> {formatExampleInput(ex.input)}</div>
                        <div><span className="font-semibold">Output:</span> {JSON.stringify(ex.output)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <a
                  href={`https://leetcode.com/problems/${problem.slug}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                >
                  Open on LeetCode <ArrowUpRightSVG />
                </a>
              </>
            )}
          </div>

          {/* Editor / judge pane */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {judgeSupported ? (
              <>
                <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10 flex-shrink-0">
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
                  {!judgeReady && (
                    <span className="text-xs text-gray-500 ml-1">C++ execution isn't wired up yet -- try Java for now</span>
                  )}
                </div>

                <div className="flex-1 min-h-0">
                  <Editor
                    height="100%"
                    language={language === 'cpp' ? 'cpp' : 'java'}
                    value={codeByLanguage[language]}
                    onChange={handleCodeChange}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true
                    }}
                  />
                </div>

                {(verdict || actionError || testResults) && (
                  <div className="px-6 py-3 border-t border-white/10 max-h-48 overflow-y-auto flex-shrink-0">
                    {actionError && (
                      <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-2">
                        {actionError}
                      </div>
                    )}
                    {verdict && (
                      <div className={`text-sm font-semibold mb-2 ${verdict === 'accepted' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        Verdict: {verdict}
                      </div>
                    )}
                    {Array.isArray(testResults) && testResults.map((t, i) => (
                      <div key={i} className={`text-xs rounded-lg px-3 py-2 mb-1.5 border ${t.passed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                        <div className="font-semibold">Test case {i + 1}: {t.passed ? 'Passed' : 'Failed'}</div>
                        <div className="mt-1 space-y-0.5">
                          <div>Input: {JSON.stringify(t.input)}</div>
                          <div>Expected: {JSON.stringify(t.expectedOutput)}</div>
                          {t.error ? <div>Error: {t.error}</div> : <div>Got: {JSON.stringify(t.actualOutput)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
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
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="max-w-sm">
                  <div className="text-sm font-medium text-gray-300 mb-1.5">In-app judge isn't available for this problem yet</div>
                  <div className="text-xs text-gray-500 leading-relaxed">
                    Solve it on LeetCode using the link on the left, then close this and click "Verify via LeetCode" on the contest page.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
