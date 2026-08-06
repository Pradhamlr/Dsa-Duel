import React from 'react'

// LeetCode-style progress ring. Two things are happening at once, which is what makes
// it more informative than a plain progress circle:
//   1. Each difficulty gets an arc SLICE whose angular span is that difficulty's share
//      of the whole catalog (so a catalog that's 2/3 Medium gives Medium 2/3 of the ring).
//   2. Within its own slice, the brightly-filled leading portion is that difficulty's
//      solved/total ratio -- the dim remainder is what's left to solve.
// So slice size answers "how much of the catalog is this?" and fill answers "how far
// through it am I?", independently.

const DIFFICULTY_COLORS = {
  Easy: { bright: '#34d399', dim: 'rgba(52, 211, 153, 0.18)', text: 'text-emerald-400' },
  Medium: { bright: '#fbbf24', dim: 'rgba(251, 191, 36, 0.18)', text: 'text-amber-400' },
  Hard: { bright: '#fb7185', dim: 'rgba(251, 113, 133, 0.18)', text: 'text-rose-400' }
}

// Fixed order so the ring's slices don't reshuffle between renders if the API returns
// object keys in a different order.
const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard']

const SIZE = 200
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CENTER = SIZE / 2

// The ring is drawn as an open arc with a gap at the bottom, not a full circle: it
// starts bottom-left (225 deg in this coordinate system, where 0 = top and angles
// increase clockwise) and sweeps 270 deg clockwise, through left/top/right, ending at
// bottom-right (135 deg). The untouched 90 deg is the gap at the bottom.
const START_ANGLE = 225
const SWEEP = 270
// Small blank wedge between adjacent difficulty slices so they read as distinct arcs
// rather than one continuous band. Has to be wide enough to actually show as a gap
// once round line caps are accounted for: each stroke's rounded end bulges STROKE/2
// past its true endpoint in the tangential direction, so two adjacent slices' caps eat
// into a too-small gap from both sides and visually blend into a muddy seam instead of
// a clean separation -- verified live (a 4deg gap produced exactly that overlap at
// RADIUS=93/STROKE=14). 12deg leaves clear daylight between the caps at this radius.
const SLICE_GAP_DEG = 12

const polarToCartesian = (angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) }
}

const describeArc = (startDeg, endDeg) => {
  // An SVG arc path can't express a full 360 in one segment (start and end points would
  // be identical), and a zero-length arc shouldn't render at all.
  if (endDeg - startDeg <= 0.01) return ''
  const start = polarToCartesian(startDeg)
  const end = polarToCartesian(Math.min(endDeg, startDeg + 359.99))
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export default function SolveProgressRing({ stats }) {
  if (!stats) return null

  const { solved = 0, attempting = 0, totalCatalog = 0, byDifficulty = {} } = stats

  const present = DIFFICULTY_ORDER.filter((d) => byDifficulty[d])
  // Guard against a divide-by-zero on an empty catalog rather than rendering NaN paths.
  const catalogTotal = totalCatalog > 0 ? totalCatalog : 1

  let cursor = START_ANGLE
  const slices = present.map((difficulty) => {
    const { solved: dSolved, total } = byDifficulty[difficulty]
    const share = total / catalogTotal
    const fullSpan = SWEEP * share
    // The gap is carved out of the slice itself so the slices still sum to SWEEP.
    const span = Math.max(fullSpan - SLICE_GAP_DEG, 0)
    const ratio = total > 0 ? dSolved / total : 0

    const slice = {
      difficulty,
      start: cursor,
      end: cursor + span,
      filledEnd: cursor + span * ratio,
      colors: DIFFICULTY_COLORS[difficulty] || DIFFICULTY_COLORS.Medium
    }
    cursor += fullSpan
    return slice
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="block">
          {slices.map((s) => (
            <g key={s.difficulty}>
              <path
                d={describeArc(s.start, s.end)}
                fill="none"
                stroke={s.colors.dim}
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
              <path
                d={describeArc(s.start, s.filledEnd)}
                fill="none"
                stroke={s.colors.bright}
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex items-baseline gap-0.5">
            <span className="text-4xl font-bold text-gray-100 tabular-nums">{solved}</span>
            <span className="text-sm text-gray-500">/{totalCatalog}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-sm font-medium text-emerald-400">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Solved
          </div>
          <div className="text-xs text-gray-500 mt-4">
            {attempting} Attempting
          </div>
        </div>
      </div>

      <div className="flex sm:flex-col gap-3 w-full sm:w-auto">
        {present.map((difficulty) => {
          const { solved: dSolved, total } = byDifficulty[difficulty]
          const colors = DIFFICULTY_COLORS[difficulty] || DIFFICULTY_COLORS.Medium
          return (
            <div
              key={difficulty}
              className="flex-1 sm:flex-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-center sm:min-w-[110px]"
            >
              <div className={`text-xs font-semibold ${colors.text}`}>{difficulty}</div>
              <div className="text-sm font-semibold text-gray-100 tabular-nums mt-0.5">
                {dSolved}<span className="text-gray-500">/{total}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
