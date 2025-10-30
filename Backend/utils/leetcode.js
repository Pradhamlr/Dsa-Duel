import fetch from 'node-fetch';

export async function fetchLeetCodePool() {
  const res = await fetch('https://leetcode.com/api/problems/all/');
  const data = await res.json();
  const pool = data.stat_status_pairs
    .filter(q => !q.paid_only)
    .map(q => ({
      title: q.stat.question__title,
      slug: q.stat.question__title_slug,
      difficulty: ['','Easy','Medium','Hard'][q.difficulty.level]
    }))
    .filter(q => ['Easy','Medium'].includes(q.difficulty));
  return pool;
}

export function getProblemType(p){
  const txt = (p.title || p.slug || '').toLowerCase()
  if (/\b(linked ?list|linked-list)\b/.test(txt)) return 'Linked List'
  if (/\b(tree|binary tree|bst)\b/.test(txt)) return 'Tree'
  if (/\b(graph|dfs|bfs)\b/.test(txt)) return 'Graph'
  if (/\b(array|arrays?)\b/.test(txt)) return 'Array'
  if (/\b(string|strings?)\b/.test(txt)) return 'String'
  if (/\b(dynamic programming|dp)\b/.test(txt)) return 'DP'
  if (/\b(stack|queue|deque)\b/.test(txt)) return 'Stack/Queue'
  if (/\b(matrix|grid)\b/.test(txt)) return 'Matrix'
  if (/\b(hash|map|unordered)\b/.test(txt)) return 'Hash / Map'
  if (/\b(binary search|search)\b/.test(txt)) return 'Binary Search'
  if (/\b(two ?pointers|two-pointers)\b/.test(txt)) return 'Two Pointers'
  return 'Other'
}