// Backfills Problem.description (the raw problem-statement HTML) across the catalog, so
// the contest UI can show real problem details instead of just a title. Reuses
// fetchQuestionContent -- no new LeetCode API surface needed, this function already
// existed for the classification LLM fallback tier.
//
// Runs across the WHOLE catalog, not just judge-supported problems: even a
// non-judge-supported problem is worth describing, since a user can still solve it via
// LeetCode-verification and would want to read it first.
//
// Safe to interrupt and re-run: skips any problem that already has a description.
//
// Run from the Backend directory:
//   node scripts/backfillDescriptions.js

import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../utils/database.js';
import { fetchQuestionContent } from '../utils/leetcode.js';

const PROGRESS_EVERY = 50;

async function main() {
  // description is a plain String? column, not Json? -- ordinary `null` is correct here
  // (Prisma.DbNull is only needed for Json? fields, a distinction the Phase 2 backfill
  // script got bitten by once already; don't copy that pattern onto a different type).
  const problems = await prisma.problem.findMany({
    where: { description: null },
    select: { id: true, leetcodeId: true, title: true }
  });

  const alreadyDone = await prisma.problem.count({ where: { description: { not: null } } });
  console.log(`${problems.length} problem(s) left to process (${alreadyDone} already done from a prior run).\n`);

  if (problems.length === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let empty = 0;
  const failed = [];
  const startTime = Date.now();

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];

    try {
      const content = await fetchQuestionContent(problem.leetcodeId);
      await prisma.problem.update({
        where: { id: problem.id },
        data: { description: content || '' }
      });
      if (!content) empty++;
      processed++;
    } catch (error) {
      failed.push({ slug: problem.leetcodeId, title: problem.title, message: error.message });
      console.error(`  FAILED: ${problem.title} (${problem.leetcodeId}) -- ${error.message}`);
    }

    if ((i + 1) % PROGRESS_EVERY === 0 || i === problems.length - 1) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`[${i + 1}/${problems.length}] ${elapsedSec}s elapsed -- processed: ${processed}, empty: ${empty}, failed: ${failed.length}`);
    }
  }

  console.log('\n=== Backfill complete ===');
  console.log(`Processed: ${processed}`);
  console.log(`Empty/no content returned: ${empty}`);
  console.log(`Hard failures: ${failed.length}`);
  if (failed.length > 0) {
    console.log('\nFailed problems:');
    for (const f of failed) console.log(`  - ${f.title} (${f.slug}): ${f.message}`);
  }

  const totalWithDescription = await prisma.problem.count({ where: { description: { not: null } } });
  console.log(`\nTotal problems with a description now: ${totalWithDescription}`);
}

main()
  .catch((err) => {
    console.error('Backfill script crashed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
