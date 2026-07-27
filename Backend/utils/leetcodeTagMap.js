// Maps LeetCode's own topic tags (verified against the live catalog — see the
// "Total unique tags: 67" survey run during Phase 2 planning) onto this app's fixed
// bucket list. Not every LeetCode tag has a home here on purpose: this app's bucket
// list is a curated set of common practice topics, not exhaustive coverage of every
// LeetCode label. A tag with no clean semantic match (e.g. "greedy", "design",
// "sorting", "heap-priority-queue") is left unmapped rather than forced into the
// nearest bucket — a problem falls to the next classification tier only if *none*
// of its tags map to anything, which in practice is rare because "array"/"string"/
// "math"/"hash-table" alone cover the majority of the catalog.
const DIRECT_TAG_TO_BUCKET = {
  'array': 'Array',

  'string': 'String',
  'string-matching': 'String',
  'rolling-hash': 'String',
  'trie': 'String',

  'hash-table': 'Hashing',
  'hash-function': 'Hashing',

  'math': 'Math',
  'number-theory': 'Math',
  'geometry': 'Math',
  'combinatorics': 'Math',
  'probability-and-statistics': 'Math',
  'game-theory': 'Math',
  'brainteaser': 'Math',

  'dynamic-programming': 'DP',
  'memoization': 'DP',

  'binary-search': 'BinarySearch',

  'two-pointers': 'TwoPointers',

  'matrix': 'Matrix',

  'database': 'Database',

  'stack': 'Stack',
  'monotonic-stack': 'Stack',

  'queue': 'Queue',
  'monotonic-queue': 'Queue',
  'sliding-window': 'Queue',

  'linked-list': 'LinkedList',
  'doubly-linked-list': 'LinkedList',

  'tree': 'Tree',
  'binary-tree': 'Tree',
  'binary-search-tree': 'Tree',
  'segment-tree': 'Tree',
  'binary-indexed-tree': 'Tree',

  'graph': 'Graph',
  'topological-sort': 'Graph',
  'union-find': 'Graph',
  'shortest-path': 'Graph',
  'minimum-spanning-tree': 'Graph',
  'strongly-connected-component': 'Graph',
  'biconnected-component': 'Graph',
  'eulerian-circuit': 'Graph'
};

// DFS/BFS apply to both trees and general graphs. Rather than guess, only count them
// as "Graph" when the same problem has no tree-family tag — a tree DFS problem should
// surface as Tree, not Graph, for contest-topic-practice purposes.
const TREE_TAGS = new Set(['tree', 'binary-tree', 'binary-search-tree']);
const TRAVERSAL_TAGS = new Set(['depth-first-search', 'breadth-first-search']);

export function mapLeetCodeTagsToBuckets(topicTagSlugs) {
  const tags = new Set(topicTagSlugs || []);
  const buckets = new Set();

  for (const tag of tags) {
    const bucket = DIRECT_TAG_TO_BUCKET[tag];
    if (bucket) buckets.add(bucket);
  }

  const hasTreeTag = [...tags].some((t) => TREE_TAGS.has(t));
  const hasTraversalTag = [...tags].some((t) => TRAVERSAL_TAGS.has(t));
  if (hasTraversalTag && !hasTreeTag) {
    buckets.add('Graph');
  }

  return buckets.size > 0 ? [...buckets] : ['Other'];
}
