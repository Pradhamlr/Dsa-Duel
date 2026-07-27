import { withPrisma } from './database.js';
import { fetchLeetCodePool, fetchQuestionContent } from './leetcode.js';
import { classifyProblem } from '../services/aiTagger.js';
import { mapLeetCodeTagsToBuckets } from './leetcodeTagMap.js';
import { isBadTagSet } from './tagQuality.js';

export async function ingestProblem(leetcodeProblem) {
  return await withPrisma(async (prisma) => {
    // Check if problem already exists
    const existing = await prisma.problem.findUnique({
      where: { leetcodeId: leetcodeProblem.slug }
    });

    if (existing) return existing;

    const leetcodeTags = leetcodeProblem.topicTags || [];
    const mappedTags = mapLeetCodeTagsToBuckets(leetcodeTags);

    let finalTags = mappedTags;
    let tagSource = 'leetcode';
    let aiStatus = 'completed';
    let aiTags = [];
    let lastAiTriedAt = null;

    // Only the residual LeetCode's own tags don't resolve reaches the LLM tier.
    if (isBadTagSet(mappedTags)) {
      try {
        const description = await fetchQuestionContent(leetcodeProblem.slug);
        aiTags = await classifyProblem({
          title: leetcodeProblem.title,
          description,
          leetcodeTags
        });

        // A successful call is a resolved answer either way -- including a confident
        // "Other" -- so it's "completed", not "pending". Only a thrown error (network/
        // rate-limit/parsing) means we genuinely don't know yet and should retry later.
        finalTags = aiTags;
        tagSource = 'ai';
        aiStatus = 'completed';
      } catch (error) {
        finalTags = ['Other'];
        tagSource = 'leetcode';
        aiStatus = 'pending';
        lastAiTriedAt = new Date();
      }
    }

    // Create problem in database
    const problem = await prisma.problem.create({
      data: {
        leetcodeId: leetcodeProblem.slug,
        title: leetcodeProblem.title,
        difficulty: leetcodeProblem.difficulty,
        leetcodeUrl: `https://leetcode.com/problems/${leetcodeProblem.slug}/`,
        leetcodeTags,
        aiTags,
        finalTags,
        tagSource,
        aiStatus,
        lastAiTriedAt
      }
    });

    return problem;
  });
}



// Pure DB read -- never calls LeetCode live. A scheduled background job (see
// syncNewProblems below, wired into server.js) is solely responsible for keeping the
// DB stocked, so a user's contest-creation request never blocks on a live scrape or
// synchronous classification.
export async function ensureProblemsAvailable(filters, requiredCount) {
  return await withPrisma(async (prisma) => {
    const { difficulty, selectedTopics } = filters;

    const where = {};
    if (difficulty !== 'Mixed') {
      where.difficulty = difficulty;
    }
    if (selectedTopics && selectedTopics.length > 0) {
      where.finalTags = {
        hasSome: selectedTopics
      };
    }

    const currentCount = await prisma.problem.count({ where });

    if (currentCount >= requiredCount) {
      return true;
    }

    // The background sync job keeps the whole catalog synced on its own schedule, so
    // reaching here means this exact filter combination genuinely doesn't have enough
    // problems yet -- not that nobody has looked. A live scrape wouldn't find anything
    // the sync job hasn't already seen.
    throw new Error(
      `Not enough problems available for difficulty="${difficulty}", topics="${selectedTopics?.join(', ') || 'any'}" (have ${currentCount}, need ${requiredCount})`
    );
  });
}

// Background catalog sync: diffs LeetCode's current pool against what's already in the
// DB and ingests only what's new. Run once at server startup (so a fresh/empty DB
// self-populates without a manual seed script) and on a recurring interval afterward to
// pick up newly-added LeetCode problems. See server.js.
export async function syncNewProblems() {
  return await withPrisma(async (prisma) => {
    const pool = await fetchLeetCodePool();

    const existingRows = await prisma.problem.findMany({ select: { leetcodeId: true } });
    const existingIds = new Set(existingRows.map((r) => r.leetcodeId));

    const newProblems = pool.filter((p) => !existingIds.has(p.slug));

    if (newProblems.length === 0) {
      console.log('Problem sync: catalog already up to date, no new problems found.');
      return { newCount: 0, failedCount: 0 };
    }

    console.log(`Problem sync: found ${newProblems.length} new problem(s), ingesting...`);

    let failedCount = 0;
    for (const problem of newProblems) {
      try {
        await ingestProblem(problem);
      } catch (error) {
        failedCount++;
        console.error(`Problem sync: failed to ingest "${problem.title}":`, error.message);
      }
    }

    const newCount = newProblems.length - failedCount;
    console.log(`Problem sync complete: ${newCount} ingested, ${failedCount} failed.`);
    return { newCount, failedCount };
  });
}