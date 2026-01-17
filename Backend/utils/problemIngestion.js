import { withPrisma } from './database.js';
import { fetchLeetCodePool } from './leetcode.js';

export async function ingestProblem(leetcodeProblem) {
  return await withPrisma(async (prisma) => {
    // Check if problem already exists
    const existing = await prisma.problem.findUnique({
      where: { leetcodeId: leetcodeProblem.slug }
    });
    
    if (existing) return existing;

    const ruleTags = classifyWithRules(leetcodeProblem);

    let finalTags = ruleTags;
    let aiStatus = 'completed';
    let tagSource = 'rule';
    let aiTags = [];

    if (ruleTags.includes('Other')) {
      aiStatus = 'pending';
      tagSource = 'pending';
    }

    // Create problem in database
    const problem = await prisma.problem.create({
      data: {
        leetcodeId: leetcodeProblem.slug,
        title: leetcodeProblem.title,
        difficulty: leetcodeProblem.difficulty,
        leetcodeUrl: `https://leetcode.com/problems/${leetcodeProblem.slug}/`,
        leetcodeTags: ruleTags,
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
  const text = `${problem.title} ${problem.slug || ""}`.toLowerCase();
  const tags = [];

  // 1. Database / SQL
  if (/\b(sql|database|table|employee|salary|group by|join|select)\b/.test(text)) {
    tags.push("Database");
  }

  // 2. Graph
  if (/\b(graph|dfs|bfs|connected|cycle|topological|shortest path)\b/.test(text)) {
    tags.push("Graph");
  }

  // 3. Tree
  if (/\b(tree|binary tree|bst|node|ancestor|traversal)\b/.test(text)) {
    tags.push("Tree");
  }

  // 4. Linked List
  if (/\b(linked list|listnode|merge lists|reverse list)\b/.test(text)) {
    tags.push("LinkedList");
  }

  // 5. Stack
  if (/\b(stack|monotonic|parentheses|bracket)\b/.test(text)) {
    tags.push("Stack");
  }

  // 6. Queue
  if (/\b(queue|deque|sliding window)\b/.test(text)) {
    tags.push("Queue");
  }

  // 7. DP
  if (/\b(dp|dynamic programming|memo|tabulation|optimal substructure)\b/.test(text)) {
    tags.push("DP");
  }

  // 8. Binary Search
  if (/\b(binary search|search in sorted|lower bound|upper bound)\b/.test(text)) {
    tags.push("BinarySearch");
  }

  // 9. Two Pointers
  if (/\b(two pointers|slow fast|left right)\b/.test(text)) {
    tags.push("TwoPointers");
  }

  // 10. Matrix
  if (/\b(matrix|grid|2d|board)\b/.test(text)) {
    tags.push("Matrix");
  }

  // 11. Hashing
  if (/\b(hash|map|dictionary|frequency|count distinct)\b/.test(text)) {
    tags.push("Hashing");
  }

  // 12. String
  if (/\b(string|substring|palindrome|anagram|character)\b/.test(text)) {
    tags.push("String");
  }

  // 13. Math (very important for your rectangle example)
  if (/\b(rectangle|square|area|length|width|min|max|number of|count of|sum of)\b/.test(text)) {
    tags.push("Math");
    tags.push("Array"); // almost always iterating
  }

  // 14. Array (generic fallback if nothing else but still array-like)
  if (/\b(array|arrays|nums|list of|elements)\b/.test(text)) {
    tags.push("Array");
  }

  const unique = [...new Set(tags)];

  if (unique.length === 0) {
    return ["Other"];   
  }

  return unique.slice(0, 2);
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