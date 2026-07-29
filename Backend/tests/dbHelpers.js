import { prisma } from '../utils/database.js';

export { prisma };

// Real incident, not a hypothetical: this ran once against the real production Supabase
// database because DATABASE_URL wasn't explicitly exported in the calling shell, and
// Prisma's own built-in .env auto-loading (separate from -- and not fixed by -- this
// app's own dotenv.config() call) silently filled it in from Backend/.env instead. The
// whole real catalog, every contest/result/session/solve-history row, was wiped with no
// backup to recover from. This check is the actual fix: refuse to run unless the URL
// obviously points at a local/throwaway database, rather than trusting every caller to
// remember to set DATABASE_URL correctly every single time.
function assertSafeTestDatabase() {
  const url = process.env.DATABASE_URL || '';
  const looksLocal = /\/\/[^/]*(localhost|127\.0\.0\.1)([:/]|$)/.test(url);
  if (!looksLocal) {
    throw new Error(
      'Refusing to run resetDb(): DATABASE_URL does not look like a local/throwaway ' +
      'database (expected "localhost" or "127.0.0.1" in the connection string). ' +
      'Export DATABASE_URL to a local test Postgres before running tests or the e2e ' +
      'seed script -- do not bypass this check by removing it.'
    );
  }
}

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
