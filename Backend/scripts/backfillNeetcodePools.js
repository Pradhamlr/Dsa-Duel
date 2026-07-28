// One-time backfill: tags Problem.pools with "neetcode150"/"neetcode250" membership,
// sourced from real public LeetCode "favorite" lists (LeetCode's internal name for a
// shareable custom problem list) -- NOT from neetcode.io's own site, which gates the
// actual NeetCode 150/250 content behind a paid account (confirmed live: its API
// returns a decoy/default response to unauthenticated requests). These two LeetCode
// lists were independently verified before relying on them: "plakya4j" is genuinely
// named "NeetCode 150" (150 questions, 21,511 saves, publicly accessible with no auth),
// "wltg7jn2" is genuinely named "NeetCode 250" (250 questions). Also confirmed the
// expected real-world relationship holds: all 150 NeetCode-150 problems are a subset
// of the 250 list.
//
// Safe to re-run: each run re-fetches both lists fresh and overwrites `pools` for
// matched problems, no partial/resumable state needed (unlike backfillDescriptions.js,
// this makes only 2 external calls total, not one per problem).
//
// Run from the Backend directory:
//   node scripts/backfillNeetcodePools.js

import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../utils/database.js';
import { fetchFavoriteQuestionList } from '../utils/leetcode.js';

const NEETCODE_150_SLUG = 'plakya4j';
const NEETCODE_250_SLUG = 'wltg7jn2';

async function main() {
  console.log('Fetching NeetCode 150 list from LeetCode...');
  const list150 = await fetchFavoriteQuestionList(NEETCODE_150_SLUG);
  console.log(`  ${list150.length} problems fetched`);

  console.log('Fetching NeetCode 250 list from LeetCode...');
  const list250 = await fetchFavoriteQuestionList(NEETCODE_250_SLUG);
  console.log(`  ${list250.length} problems fetched`);

  const poolsBySlug = new Map();
  for (const p of list150) poolsBySlug.set(p.slug, new Set(['neetcode150']));
  for (const p of list250) {
    if (!poolsBySlug.has(p.slug)) poolsBySlug.set(p.slug, new Set());
    poolsBySlug.get(p.slug).add('neetcode250');
  }

  console.log(`\n${poolsBySlug.size} distinct problems across both lists. Matching against the catalog...`);

  let matched = 0;
  const unmatched = [];

  for (const [slug, pools] of poolsBySlug.entries()) {
    const result = await prisma.problem.updateMany({
      where: { leetcodeId: slug },
      data: { pools: Array.from(pools) }
    });
    if (result.count > 0) {
      matched++;
    } else {
      unmatched.push(slug);
    }
  }

  console.log(`\n=== Backfill complete ===`);
  console.log(`Matched and tagged: ${matched}`);
  console.log(`Not found in catalog: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('Unmatched slugs:', unmatched.join(', '));
  }

  const neetcode150Count = await prisma.problem.count({ where: { pools: { has: 'neetcode150' } } });
  const neetcode250Count = await prisma.problem.count({ where: { pools: { has: 'neetcode250' } } });
  console.log(`\nDB now has ${neetcode150Count} problems tagged neetcode150, ${neetcode250Count} tagged neetcode250.`);
}

main()
  .catch((err) => {
    console.error('Backfill script crashed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
