// Phase 2 of the in-app judge feature: for every problem already in the DB, fetch its
// real function signature, per-language starter code, and example test cases from
// LeetCode, then decide whether it's simple enough (a single function call, not a
// class-design/SQL problem) to support in-app judging at all.
//
// Safe to interrupt and re-run: skips any problem that already has functionSignature
// populated, so a re-run only picks up where it left off.
//
// Run from the Backend directory:
//   node scripts/backfillJudgeMetadata.js

import dotenv from 'dotenv';
dotenv.config();

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database.js';
import { fetchQuestionDetail } from '../utils/leetcode.js';
import { isJudgeSupported, buildTestCases } from '../utils/judgeMetadata.js';

const PROGRESS_EVERY = 50;

async function main() {
  // Json? fields need the Prisma.DbNull sentinel in filters, not a plain `null` --
  // Prisma treats a JSON column's SQL NULL and a literal JSON `null` value as distinct,
  // so a bare `null` here is rejected as ambiguous.
  const problems = await prisma.problem.findMany({
    where: { functionSignature: { equals: Prisma.DbNull } },
    select: { id: true, leetcodeId: true, title: true }
  });

  const alreadyDone = await prisma.problem.count({ where: { functionSignature: { not: Prisma.DbNull } } });

  console.log(`${problems.length} problem(s) left to process (${alreadyDone} already done from a prior run).\n`);

  if (problems.length === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  const stats = {
    processed: 0,
    judgeSupported: 0,
    excludedClassDesign: 0,
    excludedManual: 0,
    excludedMissingSnippets: 0,
    excludedOther: 0,
    supportedZeroTestCases: 0, // covered by isJudgeSupported but extraction found no pairable cases
    totalTestCases: 0,
    failed: []
  };

  const startTime = Date.now();

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];

    try {
      const detail = await fetchQuestionDetail(problem.leetcodeId);
      const supported = isJudgeSupported(detail.metaData, detail.codeSnippets);

      let testCases = [];
      if (supported) {
        testCases = buildTestCases(detail.metaData, detail.exampleTestcases, detail.content);
        stats.judgeSupported++;
        stats.totalTestCases += testCases.length;
        if (testCases.length === 0) stats.supportedZeroTestCases++;
      } else if (detail.metaData?.classname) {
        stats.excludedClassDesign++;
      } else if (detail.metaData?.manual === true) {
        stats.excludedManual++;
      } else if (!detail.codeSnippets?.java || !detail.codeSnippets?.cpp) {
        stats.excludedMissingSnippets++;
      } else {
        stats.excludedOther++;
      }

      await prisma.problem.update({
        where: { id: problem.id },
        data: {
          functionSignature: detail.metaData || {},
          codeSnippets: {
            java: detail.codeSnippets?.java || null,
            cpp: detail.codeSnippets?.cpp || null
          },
          testCases,
          judgeSupported: supported
        }
      });

      stats.processed++;
    } catch (error) {
      stats.failed.push({ slug: problem.leetcodeId, title: problem.title, message: error.message });
      console.error(`  FAILED: ${problem.title} (${problem.leetcodeId}) -- ${error.message}`);
    }

    if ((i + 1) % PROGRESS_EVERY === 0 || i === problems.length - 1) {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(
        `[${i + 1}/${problems.length}] ${elapsedSec}s elapsed -- ` +
        `judge-supported: ${stats.judgeSupported}, excluded: ${stats.processed - stats.judgeSupported}, failed: ${stats.failed.length}`
      );
    }
  }

  console.log('\n=== Backfill complete ===');
  console.log(`Processed:                 ${stats.processed}`);
  console.log(`Judge-supported:           ${stats.judgeSupported}`);
  console.log(`  -> zero test cases found: ${stats.supportedZeroTestCases} (supported by shape, but output-extraction found nothing to pair -- coverage gap, candidate for an LLM-assisted extraction pass later)`);
  console.log(`  -> avg test cases:        ${stats.judgeSupported > 0 ? (stats.totalTestCases / stats.judgeSupported).toFixed(2) : 'n/a'}`);
  console.log(`Excluded -- class-design:  ${stats.excludedClassDesign}`);
  console.log(`Excluded -- SQL/manual:    ${stats.excludedManual}`);
  console.log(`Excluded -- missing snippets: ${stats.excludedMissingSnippets}`);
  console.log(`Excluded -- other:         ${stats.excludedOther}`);
  console.log(`Hard failures:             ${stats.failed.length}`);
  if (stats.failed.length > 0) {
    console.log('\nFailed problems:');
    for (const f of stats.failed) {
      console.log(`  - ${f.title} (${f.slug}): ${f.message}`);
    }
  }

  const totalSupported = await prisma.problem.count({ where: { judgeSupported: true } });
  console.log(`\nTotal judge-supported problems in DB now: ${totalSupported}`);
}

main()
  .catch((err) => {
    console.error('Backfill script crashed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
