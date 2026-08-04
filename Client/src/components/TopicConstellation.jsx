import React from 'react'

// Single source of truth for the topic list -- both the desktop radial layout below
// and Home.jsx's mobile grouped-pill fallback import this same array, so there's no
// second copy of "what topics exist" to drift out of sync. `ring` drives radial
// position (see RING_RADIUS) and visual weight (see RING_STYLE) -- inner rings read as
// more prominent, outer rings recede, instead of all 15 nodes fighting for equal
// attention at once.
export const TOPIC_NODES = [
  { id: 'Array', label: 'Array', ring: 1, category: 'Core', angle: 90 },
  { id: 'String', label: 'String', ring: 1, category: 'Core', angle: 210 },
  { id: 'LinkedList', label: 'Linked List', ring: 1, category: 'Core', angle: 330 },

  // Angles deliberately offset from ring 1's 90/210/330 rather than evenly spaced --
  // a small radius gap plus near-identical angle guarantees pill overlap regardless
  // of label length, and DP's label is long enough that even a partial radial
  // alignment collides (found via a real render, not assumed): DP sits at 45, the
  // angle furthest from every ring-1 node, and the rest fill in around it.
  { id: 'DP', label: 'Dynamic Programming', ring: 2, category: 'Advanced', angle: 45 },
  { id: 'Graph', label: 'Graph', ring: 2, category: 'Advanced', angle: 135 },
  { id: 'Tree', label: 'Tree', ring: 2, category: 'Advanced', angle: 225 },
  { id: 'BinarySearch', label: 'Binary Search', ring: 2, category: 'Advanced', angle: 315 },

  { id: 'Stack', label: 'Stack', ring: 3, category: 'Specialized', angle: 15 },
  { id: 'Queue', label: 'Queue', ring: 3, category: 'Specialized', angle: 55 },
  { id: 'Matrix', label: 'Matrix', ring: 3, category: 'Specialized', angle: 95 },
  { id: 'Hashing', label: 'Hash/Map', ring: 3, category: 'Specialized', angle: 145 },
  { id: 'Database', label: 'Database', ring: 3, category: 'Specialized', angle: 180 },
  { id: 'TwoPointers', label: 'Two Pointers', ring: 3, category: 'Specialized', angle: 220 },
  { id: 'Math', label: 'Math', ring: 3, category: 'Specialized', angle: 275 },
  { id: 'Other', label: 'Other', ring: 3, category: 'Specialized', angle: 320 }
]

// Percent-of-container-width radii, all comfortably under 50 (the edge) so pills have
// room to extend past their own center point without clipping against the container.
const RING_RADIUS = { 1: 16, 2: 33, 3: 47 }

// Visual weight tapers outward -- inner rings read as more prominent (bigger, bolder,
// brighter), outer rings recede (smaller, lighter weight, more muted text), so the
// whole thing reads as a hierarchy at a glance instead of 15 identically-weighted
// boxes competing for attention.
const RING_STYLE = {
  1: { padding: '9px 18px', fontSize: '0.8125rem', fontWeight: 600, idleText: '#e5e7eb' },
  2: { padding: '8px 15px', fontSize: '0.75rem', fontWeight: 500, idleText: '#c3c9d3' },
  3: { padding: '7px 13px', fontSize: '0.6875rem', fontWeight: 500, idleText: '#9ca3af' }
}

const nodeId = (id) => `topic-node-${id}`

// Tab/arrow-key order: center first, then ring by ring, angle order within a ring --
// matches the visual reading order (inner to outer, clockwise from the top).
const TAB_ORDER = [
  'All',
  ...TOPIC_NODES.slice().sort((a, b) => a.ring - b.ring || a.angle - b.angle).map((n) => n.id)
]

// index.css's plain, unlayered `button {...}` rule family beats Tailwind utilities
// regardless of specificity (unlayered CSS always wins over @layer'd rules) -- already
// hit this for color/backdrop-filter/border-radius/box-shadow/position this session.
// The centering `translate(-50%, -50%)` used to live on the button itself, which hit a
// *sharper* version of the same problem: `button:disabled { transform: none
// !important }` (index.css) forcibly strips any transform the instant a node becomes
// disabled -- !important beats even inline styles, so there was no inline override
// available. Confirmed live: Database visibly jumped away from its ring position the
// moment a NeetCode pool made it disabled, since without the translate it was
// positioned by its top-left corner instead of its center. Fix: the positioning +
// centering transform now lives on a plain wrapper <div>, which no `button` rule can
// ever touch regardless of the button inside it being disabled.
const wrapperStyle = (x, y) => ({
  position: 'absolute',
  left: `${x}%`, top: `${y}%`,
  transform: 'translate(-50%, -50%)'
})

const baseButtonStyle = {
  whiteSpace: 'nowrap',
  border: '1px solid transparent',
  borderRadius: 9999,
  cursor: 'pointer',
  transition: 'color 150ms ease, border-color 150ms ease, background-color 150ms ease',
  boxShadow: 'none',
  backdropFilter: 'none'
}

const COLORS = {
  // Idle state is background-only, no border -- a grid of 15 outlined boxes is what
  // made the first pass read as "packed"; a flat, borderless pill blends into the
  // card and lets the selected/hovered state actually stand out. Solid fills
  // throughout (including selected -- a translucent selected fill next to solid idle
  // pills read as "this one went transparent" rather than "this one is selected").
  idleBg: '#1f2937',
  hoverBg: '#293548', hoverBorder: '#4b5563',
  selectedBg: '#4f46e5', selectedBorder: '#6366f1', selectedText: '#ffffff',
  disabledBg: '#161d29', disabledText: '#4b5563'
}

function nodeColors(idleText, selected, disabled) {
  if (disabled) return { background: COLORS.disabledBg, color: COLORS.disabledText, cursor: 'not-allowed' }
  if (selected) return { background: COLORS.selectedBg, borderColor: COLORS.selectedBorder, color: COLORS.selectedText }
  return { background: COLORS.idleBg, color: idleText }
}

export default function TopicConstellation({ topic, setTopic, pool, searchTerm }) {
  const search = searchTerm.trim().toLowerCase()

  const nodes = TOPIC_NODES.map((t) => {
    const rad = (t.angle * Math.PI) / 180
    const r = RING_RADIUS[t.ring]
    return {
      ...t,
      x: 50 + r * Math.cos(rad),
      // Screen Y grows downward, so subtracting keeps angle=90 ("up" in the usual
      // sense) actually rendering above center instead of below it.
      y: 50 - r * Math.sin(rad),
      disabled: Boolean(pool && t.id === 'Database'),
      matches: !search || t.label.toLowerCase().includes(search)
    }
  })

  // Which ring (if any) the current selection belongs to -- "Any Topic" isn't on any
  // ring, so nothing lights up in that case, which is correct (it has no category).
  const selectedRing = topic === 'All' ? null : nodes.find((n) => n.id === topic)?.ring

  const focusNode = (id) => document.getElementById(nodeId(id))?.focus()

  const handleKeyDown = (e, currentId) => {
    const idx = TAB_ORDER.indexOf(currentId)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      focusNode(TAB_ORDER[(idx + 1) % TAB_ORDER.length])
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      focusNode(TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length])
    }
  }

  const hoverProps = (isSelected, isDisabled) => isDisabled ? {} : {
    onMouseEnter: (e) => {
      if (isSelected) return
      e.currentTarget.style.backgroundColor = COLORS.hoverBg
      e.currentTarget.style.borderColor = COLORS.hoverBorder
    },
    onMouseLeave: (e) => {
      if (isSelected) return
      e.currentTarget.style.backgroundColor = COLORS.idleBg
      e.currentTarget.style.borderColor = 'transparent'
    }
  }

  return (
    <div className="hidden md:block relative mx-auto w-full max-w-[600px] my-8" style={{ aspectRatio: '1 / 1' }}>
      {/* Orbit rings -- faint by default (structural reference only), except the ring
          the current selection belongs to, which lights up in the same indigo used
          for the selected pill's own border -- one consistent color signal instead of
          two different ones. No center-to-selected connector line (tried it, dropped
          it): a thin line at an arbitrary angle across a field of pills read as
          slightly off no matter how it was tuned; lighting the whole ring instead is
          also more informative -- it shows the category, not just a point. */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" style={{ position: 'absolute', overflow: 'visible' }}>
        <defs>
          <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" />
          </filter>
        </defs>
        {[16, 33, 47].map((r, i) => {
          const isActive = selectedRing === i + 1
          return (
            <React.Fragment key={r}>
              {isActive && (
                <circle cx="50" cy="50" r={r} fill="none" stroke={COLORS.selectedBorder} strokeWidth="0.9" opacity="0.45" filter="url(#ringGlow)" />
              )}
              <circle
                cx="50" cy="50" r={r} fill="none"
                stroke={isActive ? COLORS.selectedBorder : 'rgba(255,255,255,0.05)'}
                strokeWidth={isActive ? '0.4' : '0.25'}
                opacity={isActive ? 0.8 : 1}
              />
            </React.Fragment>
          )
        })}
      </svg>

      <div style={wrapperStyle(50, 50)}>
        <button
          id={nodeId('All')}
          type="button"
          onClick={() => setTopic('All')}
          onKeyDown={(e) => handleKeyDown(e, 'All')}
          aria-pressed={topic === 'All'}
          {...hoverProps(topic === 'All', false)}
          style={{
            ...baseButtonStyle,
            ...nodeColors('#f3f4f6', topic === 'All', false),
            borderColor: topic === 'All' ? COLORS.selectedBorder : 'transparent',
            padding: '11px 24px', fontSize: '0.9375rem', fontWeight: 700
          }}
        >
          Any Topic
        </button>
      </div>

      {nodes.map((n) => {
        const ringStyle = RING_STYLE[n.ring]
        return (
          <div key={n.id} style={wrapperStyle(n.x, n.y)}>
            <button
              id={nodeId(n.id)}
              type="button"
              onClick={() => !n.disabled && setTopic(n.id)}
              onKeyDown={(e) => handleKeyDown(e, n.id)}
              disabled={n.disabled}
              aria-pressed={topic === n.id}
              title={n.disabled ? 'Not in either NeetCode list' : undefined}
              {...hoverProps(topic === n.id, n.disabled)}
              style={{
                ...baseButtonStyle,
                ...nodeColors(ringStyle.idleText, topic === n.id, n.disabled),
                borderColor: topic === n.id ? COLORS.selectedBorder : 'transparent',
                padding: ringStyle.padding, fontSize: ringStyle.fontSize, fontWeight: ringStyle.fontWeight,
                opacity: n.matches ? 1 : 0.2
              }}
            >
              {n.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
