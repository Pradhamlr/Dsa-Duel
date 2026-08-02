import { prisma } from '../utils/database.js';
import { assertSafeTestDatabase } from '../utils/dbSafety.js';

export { prisma };

// Full wipe between test files -- this DB only ever exists as a throwaway CI/local test
// instance (never the real Supabase one), so truncating everything is simpler and safer
// than trying to scope deletes to "this test's own rows." Explicit child-before-parent
// order regardless of which FKs already cascade, so this stays correct even if the
// schema's cascade settings change later.
export async function resetDb() {
  assertSafeTestDatabase();
  await prisma.submission.deleteMany();
  await prisma.result.deleteMany();
  await prisma.solvedProblem.deleteMany();
  await prisma.session.deleteMany();
  await prisma.contest.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.user.deleteMany();
}

let problemCounter = 0;

// Minimal valid Problem row -- enough to satisfy ensureProblemsAvailable's filters
// (difficulty/finalTags/pools) without needing real LeetCode-shaped judge metadata,
// since these tests never exercise the judge/run/submit path.
export function makeProblem(overrides = {}) {
  problemCounter += 1;
  const n = problemCounter;
  return {
    id: `test-problem-${n}`,
    leetcodeId: `test-problem-${n}`,
    title: `Test Problem ${n}`,
    difficulty: 'Easy',
    leetcodeUrl: `https://leetcode.com/problems/test-problem-${n}/`,
    leetcodeTags: ['Array'],
    aiTags: [],
    finalTags: ['Array'],
    tagSource: 'leetcode',
    judgeSupported: false,
    pools: [],
    ...overrides
  };
}

export async function seedProblems(prisma, count, overrides = {}) {
  const problems = Array.from({ length: count }, () => makeProblem(overrides));
  await prisma.problem.createMany({ data: problems });
  return problems;
}
