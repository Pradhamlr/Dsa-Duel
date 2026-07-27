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
        aiStatus
      }
    });

    return problem;
  });
}



export async function ensureProblemsAvailable(filters, requiredCount) {
  return await withPrisma(async (prisma) => {
    const { difficulty, selectedTopics } = filters;

    // Build query to check current availability with topic filters
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
    console.log(`Current problems in DB (difficulty: ${difficulty}, topics: ${selectedTopics?.join(', ') || 'all'}): ${currentCount}, needed: ${requiredCount}`);
    
    if (currentCount >= requiredCount) {
      return true;
    }

    // Need to ingest more problems
    const needed = Math.max(requiredCount - currentCount, 20); // Ingest at least 20
    console.log(`Need to ingest ${needed} more problems`);
    
    const leetcodePool = await fetchLeetCodePool();
    console.log(`LeetCode pool size: ${leetcodePool.length}`);
    
    // Filter by difficulty
    let filteredPool = difficulty !== 'Mixed' 
      ? leetcodePool.filter(p => p.difficulty === difficulty)
      : leetcodePool;
    
    console.log(`Filtered pool size for ${difficulty}: ${filteredPool.length}`);

    if (filteredPool.length === 0) {
      throw new Error(`No problems available for difficulty: ${difficulty}`);
    }

    // Prioritize problems that will match selected topics once ingested. This is no
    // longer a guess: p.topicTags are LeetCode's real tags (from fetchLeetCodePool),
    // so mapLeetCodeTagsToBuckets computes the same primary-tier result ingestProblem
    // will store. The small residual that needs the LLM tier to resolve (mapped to
    // "Other" here) just gets deprioritized rather than guessed at.
    if (selectedTopics && selectedTopics.length > 0) {
      const withPriority = filteredPool.map(p => {
        const predictedTags = mapLeetCodeTagsToBuckets(p.topicTags);
        const matchesTopics = selectedTopics.some(topic => predictedTags.includes(topic));
        return { problem: p, priority: matchesTopics ? 1 : 0 };
      });
      
      // Sort by priority (matching topics first), then shuffle within each group
      withPriority.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return Math.random() - 0.5;
      });
      
      filteredPool = withPriority.map(wp => wp.problem);
    } else {
      // No topic filter, just shuffle
      filteredPool = filteredPool.sort(() => Math.random() - 0.5);
    }

    // Take problems to ingest
    const toIngest = filteredPool.slice(0, Math.min(needed, filteredPool.length));
    
    console.log(`Attempting to ingest ${toIngest.length} problems`);

    // Ingest problems
    let successCount = 0;
    for (const problem of toIngest) {
      try {
        await ingestProblem(problem);
        successCount++;
        if (successCount % 5 === 0) {
          console.log(`Ingested ${successCount}/${toIngest.length} problems...`);
        }
      } catch (error) {
        console.error('Failed to ingest problem:', problem.title, error.message);
      }
    }
    
    console.log(`Successfully ingested ${successCount} problems`);
    return true;
  });
}