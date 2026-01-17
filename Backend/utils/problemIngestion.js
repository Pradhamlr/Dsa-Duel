import { withPrisma } from './database.js';
import { fetchLeetCodePool } from './leetcode.js';
import { classifyProblem } from '../services/aiTagger.js';
import { isBadTagSet } from './tagQuality.js';

export async function ingestProblem(leetcodeProblem) {
  return await withPrisma(async (prisma) => {
    // Check if problem already exists
    const existing = await prisma.problem.findUnique({
      where: { leetcodeId: leetcodeProblem.slug }
    });
    
    if (existing) return existing;

    // Step 1: Rule-based tagging (always works)
    const ruleBasedTags = classifyWithRules(leetcodeProblem);
    
    let finalTags = ruleBasedTags;
    let tagSource = 'leetcode';
    let aiStatus = 'pending';
    let aiTags = [];

    // Step 2: AI enhancement (if available and rule-based tags are poor)
    if (isBadTagSet(ruleBasedTags)) {
      try {
        console.log(`Attempting AI classification for: ${leetcodeProblem.title}`);
        aiTags = await classifyProblem({
          title: leetcodeProblem.title,
          description: '',
          constraints: ''
        });
        
        if (aiTags && aiTags.length > 0 && !aiTags.includes('Other')) {
          finalTags = aiTags;
          tagSource = 'ai';
          aiStatus = 'completed';
          console.log(`AI classification successful: ${aiTags.join(', ')}`);
        } else {
          aiStatus = 'completed';
          console.log(`AI returned poor tags, keeping rule-based: ${ruleBasedTags.join(', ')}`);
        }
      } catch (error) {
        console.warn(`AI classification deferred for ${leetcodeProblem.title}: ${error.message}`);
        // Keep aiStatus as 'pending' - do NOT mark as failed
      }
    } else {
      aiStatus = 'completed'; // Rule-based tags are good, no AI needed
    }

    // Create problem in database
    const problem = await prisma.problem.create({
      data: {
        leetcodeId: leetcodeProblem.slug,
        title: leetcodeProblem.title,
        difficulty: leetcodeProblem.difficulty,
        leetcodeUrl: `https://leetcode.com/problems/${leetcodeProblem.slug}/`,
        leetcodeTags: ruleBasedTags,
        aiTags,
        finalTags,
        tagSource,
        aiStatus
      }
    });

    return problem;
  });
}

// Rule-based classification (reliable fallback)
function classifyWithRules(problem) {
  const text = `${problem.title} ${problem.slug}`.toLowerCase();
  const tags = [];

  if (/\b(array|subarray|subsequence|list)\b/.test(text)) tags.push("Array");
  if (/\b(string|substring|palindrome|anagram)\b/.test(text)) tags.push("String");
  if (/\b(tree|binary tree|bst|node)\b/.test(text)) tags.push("Tree");
  if (/\b(graph|dfs|bfs|connected|path)\b/.test(text)) tags.push("Graph");
  if (/\b(linked list|listnode)\b/.test(text)) tags.push("LinkedList");
  if (/\b(stack)\b/.test(text)) tags.push("Stack");
  if (/\b(queue)\b/.test(text)) tags.push("Queue");
  if (/\b(hash|map|dict|frequency|count)\b/.test(text)) tags.push("Hashing");
  if (/\b(matrix|grid|2d|board)\b/.test(text)) tags.push("Matrix");
  if (/\b(binary search)\b/.test(text)) tags.push("BinarySearch");
  if (/\b(two pointer|left right|slow fast)\b/.test(text)) tags.push("TwoPointers");
  if (/\b(dp|dynamic programming|memo|cache|optimal)\b/.test(text)) tags.push("DP");

  if (!tags.length) tags.push("Array"); // fallback

  return tags;
}


export async function ensureProblemsAvailable(filters, requiredCount) {
  return await withPrisma(async (prisma) => {
    const { difficulty, selectedTopics } = filters;

    // For now, let's just ensure we have enough problems of the right difficulty
    // Topic filtering will happen at query time
    const where = {};
    if (difficulty !== 'Mixed') {
      where.difficulty = difficulty;
    }

    const currentCount = await prisma.problem.count({ where });
    console.log(`Current problems in DB (${difficulty}): ${currentCount}, needed: ${requiredCount}`);
    
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

    // Take problems to ingest
    const shuffled = filteredPool.sort(() => Math.random() - 0.5);
    const toIngest = shuffled.slice(0, Math.min(needed, shuffled.length));
    
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