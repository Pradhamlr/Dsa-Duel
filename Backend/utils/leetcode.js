import axios from 'axios';

const GRAPHQL_URL = 'https://leetcode.com/graphql';
const PAGE_SIZE = 100; // server clamps `limit` to this regardless of what's requested
const PAGE_CONCURRENCY = 5; // bounded, so this stays polite to an unofficial endpoint
const BATCH_DELAY_MS = 150;
const POOL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const PROBLEM_LIST_QUERY = `
  query problemsetQuestionList($categorySlug: String, $skip: Int, $limit: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(
      categorySlug: $categorySlug
      limit: $limit
      skip: $skip
      filters: $filters
    ) {
      total: totalNum
      questions: data {
        title
        titleSlug
        difficulty
        isPaidOnly
        topicTags {
          name
          slug
        }
      }
    }
  }
`;

const QUESTION_CONTENT_QUERY = `
  query questionContent($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      content
    }
  }
`;

const DIFFICULTY_MAP = { Easy: 'Easy', Medium: 'Medium', Hard: 'Hard' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetches the real problem-statement HTML for one problem. Only called for the small
// residual that LeetCode's own topic tags didn't resolve (see utils/leetcodeTagMap.js) —
// not worth bulk-fetching for the whole catalog.
export async function fetchQuestionContent(slug) {
  const response = await axios.post(
    GRAPHQL_URL,
    { query: QUESTION_CONTENT_QUERY, variables: { titleSlug: slug } },
    {
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 15000
    }
  );

  return response.data?.data?.question?.content || '';
}

const fetchQuestionPage = async (skip) => {
  const response = await axios.post(
    GRAPHQL_URL,
    {
      query: PROBLEM_LIST_QUERY,
      variables: { categorySlug: '', skip, limit: PAGE_SIZE, filters: {} }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 15000
    }
  );

  const payload = response.data?.data?.problemsetQuestionList;
  if (!payload) {
    throw new Error('Unexpected LeetCode GraphQL response shape');
  }

  return payload;
};

const fetchAllQuestions = async () => {
  const firstPage = await fetchQuestionPage(0);
  const questions = [...firstPage.questions];
  const total = firstPage.total;

  const remainingSkips = [];
  for (let skip = PAGE_SIZE; skip < total; skip += PAGE_SIZE) {
    remainingSkips.push(skip);
  }

  for (let i = 0; i < remainingSkips.length; i += PAGE_CONCURRENCY) {
    const batch = remainingSkips.slice(i, i + PAGE_CONCURRENCY);
    const pages = await Promise.all(batch.map((skip) => fetchQuestionPage(skip)));
    for (const page of pages) {
      questions.push(...page.questions);
    }

    if (i + PAGE_CONCURRENCY < remainingSkips.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return questions;
};

let poolCache = { data: null, fetchedAt: 0 };

export async function fetchLeetCodePool({ forceRefresh = false } = {}) {
  const isFresh = poolCache.data && (Date.now() - poolCache.fetchedAt) < POOL_CACHE_TTL_MS;
  if (isFresh && !forceRefresh) {
    return poolCache.data;
  }

  const questions = await fetchAllQuestions();

  const pool = questions
    .filter((q) => !q.isPaidOnly)
    .map((q) => ({
      title: q.title,
      slug: q.titleSlug,
      difficulty: DIFFICULTY_MAP[q.difficulty] || q.difficulty,
      topicTags: (q.topicTags || []).map((t) => t.slug)
    }))
    .filter((q) => ['Easy', 'Medium'].includes(q.difficulty));

  poolCache = { data: pool, fetchedAt: Date.now() };
  return pool;
}
