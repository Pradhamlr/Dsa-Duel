export function isBadTagSet(tags) {
  if (!tags || tags.length === 0) return true;
  if (tags.includes("Other")) return true;
  if (tags.length === 1) return true;
  // Allow single good tags - they're often correct
  return false;
}
