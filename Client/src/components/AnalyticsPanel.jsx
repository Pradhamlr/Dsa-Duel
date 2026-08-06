import React from 'react'

// Solve streak, an 84-day activity heatmap, and per-topic strength -- all derived
// server-side from the same SolvedProblem rows the ring/revision-list already use.
// Hand-rolled SVG/CSS, no charting dependency, same convention as SolveProgressRing.

const CELL_SIZE = 12
const CELL_GAP = 3

// Sequential, one hue (indigo, matching the app's own brand accent), light->dark by
// magnitude -- flipped for the dark surface: the "empty" step sits close to the
// gray-900 card background, the top step is the brightest, most saturated indigo.
const HEAT_STEPS = ['#1e293b', 'rgba(99,102,241,0.35)', 'rgba(99,102,241,0.55)', 'rgba(99,102,241,0.8)', '#818cf8']

function heatColor(count) {
  if (count <= 0) return HEAT_STEPS[0]
  if (count === 1) return HEAT_STEPS[1]
  if (count === 2) return HEAT_STEPS[2]
  if (count <= 4) return HEAT_STEPS[3]
  return HEAT_STEPS[4]
}

function formatCellDate(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function ActivityHeatmap({ history }) {
  if (!history || history.length === 0) return null

  // Pads the front of the grid so columns line up on real calendar weeks (Sun-Sat top
  // to bottom), the same layout a GitHub-style contribution graph uses -- without this,
  // the first partial week would silently shift every later week's alignment too.
  const firstDate = new Date(`${history[0].date}T00:00:00Z`)
  const leadingBlanks = firstDate.getUTCDay()
  const cells = [...Array(leadingBlanks).fill(null), ...history]

  return (
    <div
      className="inline-grid"
      style={{
        gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
        gridAutoFlow: 'column',
        gridAutoColumns: `${CELL_SIZE}px`,
        gap: `${CELL_GAP}px`
      }}
    >
      {cells.map((cell, i) => (
        <div
          key={cell ? cell.date : `blank-${i}`}
          title={cell ? `${formatCellDate(cell.date)}: ${cell.count} solved` : undefined}
          style={{
            width: CELL_SIZE,
            height: CELL_SIZE,
            borderRadius: 3,
            backgroundColor: cell ? heatColor(cell.count) : 'transparent'
          }}
        />
      ))}
    </div>
  )
}

function TopicStrengthBars({ topicStrength }) {
  const engaged = (topicStrength || []).filter((t) => t.solved > 0).slice(0, 8)

  if (engaged.length === 0) {
    return <div className="text-sm text-gray-500">Solve a few problems to see your strongest topics here.</div>
  }

  return (
    <div className="space-y-2.5">
      {engaged.map((t) => {
        const pct = t.total > 0 ? Math.round((t.solved / t.total) * 100) : 0
        return (
          <div key={t.tag} className="flex items-center gap-3">
            <div className="w-28 sm:w-32 text-xs text-gray-400 truncate flex-shrink-0">{t.tag}</div>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#6366f1' }} />
            </div>
            <div className="w-16 text-xs text-gray-500 text-right tabular-nums flex-shrink-0">{t.solved}/{t.total}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsPanel({ analytics }) {
  if (!analytics) return null

  const { streak = { current: 0, longest: 0 }, topicStrength = [], history = [] } = analytics

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3">
        <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-center">
          <div className="text-xs font-semibold text-indigo-400">Current Streak</div>
          <div className="text-2xl font-bold text-gray-100 tabular-nums mt-0.5">{streak.current}<span className="text-sm text-gray-500 font-medium"> day{streak.current === 1 ? '' : 's'}</span></div>
        </div>
        <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-center">
          <div className="text-xs font-semibold text-purple-400">Longest Streak</div>
          <div className="text-2xl font-bold text-gray-100 tabular-nums mt-0.5">{streak.longest}<span className="text-sm text-gray-500 font-medium"> day{streak.longest === 1 ? '' : 's'}</span></div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-100 mb-3">Activity, last 12 weeks</h3>
        <div className="overflow-x-auto pb-1">
          <ActivityHeatmap history={history} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-100 mb-3">Topic Strength</h3>
        <TopicStrengthBars topicStrength={topicStrength} />
      </div>
    </div>
  )
}
