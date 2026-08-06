// Deferred contest problem selection (Phase 4b): createContest only stores settings;
// startContest calls into here to actually pick the problems, trying increasingly
// permissive exclusion tiers built from the SSE roster's real SolvedProblem history so
// a contest doesn't hand out problems someone currently in the room already just
// solved/attempted. See CLAUDE.md's Phase 4b entry for the full design.
const RECENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

// testCases is deliberately excluded here -- it's the judge's answer key, and this
// snapshot is shipped straight to the client, so it must stay server-side only
// (fetched fresh at submit-time by the judge). Exported so startContest can shape
// hand-picked problems identically to auto-selected ones.
export const toContestFormat = (p) => ({
  title: p.title,
  slug: p.leetcodeId,
  difficulty: p.difficulty,
  url: p.leetcodeUrl,
  finalTags: p.finalTags,
  judgeSupported: p.judgeSupported,
  ...(p.judgeSupported ? { codeSnippets: p.codeSnippets } : {})
});

// Fetches hand-picked problems by id, in the exact order the creator picked them --
// findMany({ where: { id: { in: ids } } }) does NOT preserve `in`-array order, so
// results are manually re-sorted to match rather than relying on DB return order.
export async function fetchHandPickedProblems(prisma, problemIds) {
  if (!problemIds || problemIds.length === 0) return [];
  const problems = await prisma.problem.findMany({ where: { id: { in: problemIds } } });
  const byId = new Map(problems.map((p) => [p.id, p]));
  return problemIds.map((id) => byId.get(id)).filter(Boolean).map(toContestFormat);
}

// One filtered-query-shuffle-slice pass. Returns null (doesn't throw) if the filters
// plus whichever exclusion set the caller passed don't have enough matches -- lets the
// caller fall through to a looser tier instead of failing outright.
export async function selectContestProblems(prisma, { difficulty, selectedTopics, pool, problemCount, excludeProblemIds = [] }) {
  const where = {};
  if (difficulty !== 'Mixed') where.difficulty = difficulty;
  if (selectedTopics && selectedTopics.length > 0) where.finalTags = { hasSome: selectedTopics };
  if (pool) where.pools = { has: pool };
  if (excludeProblemIds.length > 0) where.id = { notIn: excludeProblemIds };

  const problems = await prisma.problem.findMany({ where });
  if (problems.length < problemCount) return null;

  const shuffled = problems.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, problemCount).map(toContestFormat);
}

// Four increasingly-permissive exclude-sets (problem ids), built from what anyone
// currently in the roster has solved/attempted: exclude recent attempted+solved ->
// relax to recent-solved-only -> relax to solved-ever -> no exclusion (identical to
// pre-4b plain-random behavior, so this last tier always succeeds if the catalog has
// enough matching problems at all).
export async function buildExclusionTiers(prisma, rosterUserIds) {
  if (!rosterUserIds || rosterUserIds.length === 0) {
    return [[], [], [], []];
  }

  const cutoff = new Date(Date.now() - RECENCY_WINDOW_MS);
  const dedupe = (rows) => Array.from(new Set(rows.map((r) => r.problemId)));

  const recentAny = await prisma.solvedProblem.findMany({
    where: { userId: { in: rosterUserIds }, lastInteractionAt: { gte: cutoff } },
    select: { problemId: true }
  });
  const recentSolved = await prisma.solvedProblem.findMany({
    where: { userId: { in: rosterUserIds }, status: 'solved', lastInteractionAt: { gte: cutoff } },
    select: { problemId: true }
  });
  const everSolved = await prisma.solvedProblem.findMany({
    where: { userId: { in: rosterUserIds }, status: 'solved' },
    select: { problemId: true }
  });

  return [dedupe(recentAny), dedupe(recentSolved), dedupe(everSolved), []];
}

// Walks the tiers in order, returning the first one that yields enough problems.
// baseExcludeIds (e.g. this contest's own hand-picked problems) is unioned into every
// tier unconditionally -- those must never be re-selected by the auto-fill regardless
// of which roster-based tier ends up succeeding.
export async function selectWithTieredFallback(prisma, { difficulty, selectedTopics, pool, problemCount, rosterUserIds, baseExcludeIds = [] }) {
  const tiers = await buildExclusionTiers(prisma, rosterUserIds);
  for (const tierExcludeIds of tiers) {
    const excludeProblemIds = Array.from(new Set([...baseExcludeIds, ...tierExcludeIds]));
    const chosen = await selectContestProblems(prisma, { difficulty, selectedTopics, pool, problemCount, excludeProblemIds });
    if (chosen) return chosen;
  }
  return null;
}
