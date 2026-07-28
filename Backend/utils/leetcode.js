import axios from 'axios';

const GRAPHQL_URL = 'https://leetcode.com/graphql';
const PAGE_SIZE = 100; // server clamps `limit` to this regardless of what's requested
// Sequential, not concurrent: empirically, LeetCode/Cloudflare throttles concurrent
// connections from one IP much more aggressively than sequential requests (confirmed
// live -- 2/5 concurrent requests timed out while a lone sequential request succeeded
// in under a second). This fetch no longer sits in a user's request path (see
// ensureProblemsAvailable / syncNewProblems) -- it's an unattended background job now,
// so reliability matters far more than shaving ~20s off a run nobody is waiting on.
const PAGE_CONCURRENCY = 1;
const BATCH_DELAY_MS = 250;
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

const QUESTION_DETAIL_QUERY = `
  query questionDetail($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      content
      exampleTestcases
      metaData
      codeSnippets {
        langSlug
        code
      }
    }
  }
`;

// Everything Phase 2 (judge-metadata backfill) needs for one problem, in a single
// request: real description text, LeetCode's own example inputs, the structured
// function signature, and per-language starter code. Retried like page fetches --
// a single problem timing out shouldn't kill a catalog-wide backfill run.
const fetchQuestionDetailOnce = async (slug) => {
  const response = await axios.post(
    GRAPHQL_URL,
    { query: QUESTION_DETAIL_QUERY, variables: { titleSlug: slug } },
    {
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 15000
    }
  );

  const q = response.data?.data?.question;
  if (!q) {
    throw new Error('Unexpected LeetCode GraphQL response shape');
  }

  let metaData = null;
  try {
    metaData = q.metaData ? JSON.parse(q.metaData) : null;
  } catch {
    metaData = null;
  }

  const codeSnippets = {};
  for (const snippet of q.codeSnippets || []) {
    codeSnippets[snippet.langSlug] = snippet.code;
  }

  return {
    content: q.content || '',
    exampleTestcases: q.exampleTestcases || '',
    metaData,
    codeSnippets
  };
};

export async function fetchQuestionDetail(slug) {
  let lastError;
  for (let attempt = 1; attempt <= PAGE_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetchQuestionDetailOnce(slug);
    } catch (error) {
      lastError = error;
      if (attempt < PAGE_RETRY_ATTEMPTS) {
        await sleep(PAGE_RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastError;
}

const RECENT_AC_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      titleSlug
      timestamp
    }
  }
`;

// Public, unauthenticated: the same data LeetCode's own profile page shows under
// "Recent AC". Returns [] if the user has no recent accepted submissions, the
// username doesn't exist, or the user has set their submission history to private --
// those three cases are indistinguishable at this API, which callers need to handle
// (see contestController.verifyLeetCodeSubmission).
export async function fetchRecentAcSubmissions(username, limit = 20) {
  const response = await axios.post(
    GRAPHQL_URL,
    { query: RECENT_AC_SUBMISSIONS_QUERY, variables: { username, limit } },
    {
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 15000
    }
  );

  const list = response.data?.data?.recentAcSubmissionList;
  return Array.isArray(list) ? list : [];
}

const PAGE_RETRY_ATTEMPTS = 3;
const PAGE_RETRY_DELAY_MS = 1000;

const fetchQuestionPageOnce = async (skip) => {
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

// A single page occasionally timing out against this unofficial endpoint shouldn't
// fail the entire multi-page fetch -- retry a few times with a short backoff first.
const fetchQuestionPage = async (skip) => {
  let lastError;
  for (let attempt = 1; attempt <= PAGE_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetchQuestionPageOnce(skip);
    } catch (error) {
      lastError = error;
      if (attempt < PAGE_RETRY_ATTEMPTS) {
        await sleep(PAGE_RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastError;
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

const FAVORITE_QUESTION_LIST_QUERY = `
  query favoriteQuestionList($favoriteSlug: String!, $limit: Int, $skip: Int) {
    favoriteQuestionList(favoriteSlug: $favoriteSlug, limit: $limit, skip: $skip) {
      questions {
        titleSlug
        title
      }
      totalLength
      hasMore
    }
  }
`;

const fetchFavoriteQuestionPageOnce = async (favoriteSlug, skip) => {
  const response = await axios.post(
    GRAPHQL_URL,
    { query: FAVORITE_QUESTION_LIST_QUERY, variables: { favoriteSlug, skip, limit: PAGE_SIZE } },
    {
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 15000
    }
  );

  const payload = response.data?.data?.favoriteQuestionList;
  if (!payload) {
    throw new Error('Unexpected LeetCode GraphQL response shape');
  }
  return payload;
};

const fetchFavoriteQuestionPage = async (favoriteSlug, skip) => {
  let lastError;
  for (let attempt = 1; attempt <= PAGE_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetchFavoriteQuestionPageOnce(favoriteSlug, skip);
    } catch (error) {
      lastError = error;
      if (attempt < PAGE_RETRY_ATTEMPTS) {
        await sleep(PAGE_RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastError;
};

// Fetches every problem in a public LeetCode "favorite" (LeetCode's internal name for
// a shareable custom problem list, reached at leetcode.com/problem-list/<slug>/) --
// used for NeetCode 150 (slug "plakya4j", verified live: 150 questions, 21,511 saves,
// hasAccessToFavorite.hasAccess: true with no auth) and NeetCode 250 (slug "wltg7jn2",
// 250 questions). Both confirmed genuinely public before relying on them -- neetcode.io's
// own site gates the real NeetCode 150/250 content behind a paid account, but these
// same lists are independently mirrored as public LeetCode favorites.
export async function fetchFavoriteQuestionList(favoriteSlug) {
  const firstPage = await fetchFavoriteQuestionPage(favoriteSlug, 0);
  const questions = [...firstPage.questions];
  const total = firstPage.totalLength;

  for (let skip = PAGE_SIZE; skip < total; skip += PAGE_SIZE) {
    await sleep(BATCH_DELAY_MS);
    const page = await fetchFavoriteQuestionPage(favoriteSlug, skip);
    questions.push(...page.questions);
  }

  // Verified live: this endpoint returns the FULL list on every page regardless of the
  // skip/limit sent (150 total -> 300 raw results across 2 pages, 250 -> 750 across 3),
  // not a real pagination bug in this code -- dedupe by slug rather than assume the
  // cause, which self-corrects back to the true total either way.
  const seen = new Map();
  for (const q of questions) {
    if (!seen.has(q.titleSlug)) seen.set(q.titleSlug, { slug: q.titleSlug, title: q.title });
  }
  return Array.from(seen.values());
}

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
