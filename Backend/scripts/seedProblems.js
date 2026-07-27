// One-time seed: ingest the full free Easy/Medium LeetCode catalog so the app has
// complete topic/difficulty coverage before any real user creates a contest, instead
// of the pool growing sparsely through organic traffic.
//
// Safe to interrupt and re-run: ingestProblem() skips anything already in the DB
// (checked by leetcodeId), so a re-run only picks up where it left off.
//
// Run from the Backend directory:
//   node scripts/seedProblems.js

import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../utils/database.js';
import { fetchLeetCodePool } from '../utils/leetcode.js';
import { ingestProblem } from '../utils/problemIngestion.js';

const PROGRESS_EVERY = 50;

async function main() {
  console.log('Fetching full LeetCode problem pool (this takes ~10-15s)...');
  const pool = await fetchLeetCodePool();
  console.log(`Pool size: ${pool.length} free Easy/Medium problems.\n`);

  const stats = {
    alreadyExisted: 0,
    newlyIngested: 0,
    tierLeetCode: 0, // resolved from real LeetCode tags, no LLM call
    tierAi: 0,       // resolved via the Groq fallback tier
    pending: 0,      // LLM call failed transiently, queued for the retry job
    other: 0,        // finalTags ended up ["Other"], from either tier
    failed: []       // problems that threw entirely (not caught inside ingestProblem)
  };

  const startTime = Date.now();

  for (let i = 0; i < pool.length; i++) {
    const problem = pool[i];

    try {
      const existing = await prisma.problem.findUnique({ where: { leetcodeId: problem.slug } });
      const wasNew = !existing;

      const result = await ingestProblem(problem);

      if (wasNew) {
        stats.newlyIngested++;
        if (result.tagSource === 'leetcode' && result.aiStatus === 'completed') stats.tierLeetCode++;
        if (result.tagSource === 'ai') stats.tierAi++;
        if (result.aiStatus === 'pending') stats.pending++;
        if (result.finalTags.length === 1 && result.finalTags[0] === 'Other') stats.other++;
      } else {
        stats.alreadyExisted++;
      }
    } catch (error) {
      stats.failed.push({ slug: problem.slug, title: problem.title, message: error.message });
      console.error(`  FAILED: ${problem.title} (${problem.slug}) -- ${error.message}`);
    }

    if ((i + 1) % PROGRESS_EVERY === 0 || i === pool.length - 1) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(
        `[${i + 1}/${pool.length}] ${elapsedSec}s elapsed -- ` +
        `new: ${stats.newlyIngested}, skipped (existing): ${stats.alreadyExisted}, ` +
        `LLM tier hits: ${stats.tierAi}, pending retry: ${stats.pending}, failed: ${stats.failed.length}`
      );
    }
  }

  console.log('\n=== Seed complete ===');
  console.log(`Total in pool:        ${pool.length}`);
  console.log(`Already existed:      ${stats.alreadyExisted}`);
  console.log(`Newly ingested:       ${stats.newlyIngested}`);
  console.log(`  -> via LeetCode tags (no LLM call): ${stats.tierLeetCode}`);
  console.log(`  -> via Groq LLM fallback tier:      ${stats.tierAi}`);
  console.log(`  -> queued for retry (LLM errored):  ${stats.pending}`);
  console.log(`  -> resolved to "Other":             ${stats.other}`);
  console.log(`Hard failures:        ${stats.failed.length}`);
  if (stats.failed.length > 0) {
    console.log('\nFailed problems:');
    for (const f of stats.failed) {
      console.log(`  - ${f.title} (${f.slug}): ${f.message}`);
    }
  }

  const totalInDb = await prisma.problem.count();
  console.log(`\nTotal Problem rows in DB now: ${totalInDb}`);
}

main()
  .catch((err) => {
    console.error('Seed script crashed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
