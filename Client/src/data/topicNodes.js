// Single source of truth for the topic list -- both TopicConstellation.jsx's desktop
// radial layout and Home.jsx's mobile grouped-pill fallback import this same array, so
// there's no second copy of "what topics exist" to drift out of sync. `ring` drives
// radial position (see TopicConstellation.jsx's RING_RADIUS) and visual weight (see
// RING_STYLE) -- inner rings read as more prominent, outer rings recede, instead of all
// 15 nodes fighting for equal attention at once.
//
// Split into its own file (not exported alongside the component in
// TopicConstellation.jsx) because Vite's Fast Refresh only works cleanly when a file
// exports components only -- a named data export alongside the default component
// export breaks it (react-refresh/only-export-components).
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
