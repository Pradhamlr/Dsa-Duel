import axios from 'axios';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

// Must match the bucket list the rest of the app uses (Client topic picker,
// utils/leetcodeTagMap.js).
const VALID_TAGS = [
  'Array', 'String', 'Hashing', 'Stack', 'Queue', 'LinkedList', 'Tree', 'Graph',
  'DP', 'BinarySearch', 'TwoPointers', 'Matrix', 'Math', 'Database', 'Other'
];

const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const SYSTEM_PROMPT = `You classify a competitive programming problem by the data structure or \
algorithmic technique most central to solving it.

Choose 1-2 labels from this EXACT closed set, spelled exactly as shown:
${VALID_TAGS.join(', ')}

You are called only for problems LeetCode's own topic tags didn't cleanly map onto this \
closed set — you'll be shown those original tags too. Use them as a strong hint, not \
noise: e.g. a "shell" tag means this is a shell-scripting problem (always "Other" — this \
app has no shell-script bucket), "design"/"heap-priority-queue"/"ordered-set" alone with \
nothing else in the set usually means "Other" too, not a stretch match like "Tree".

Rules:
- Pick labels based on how the problem is SOLVED, not domain words in the title.
- Prefer "Other" over a stretch match. Only pick a non-"Other" label if it genuinely fits.
- Do NOT infer "Tree" just because a structure (ordered-set, heap, balanced BST) happens
  to be implemented using a tree internally. Only use "Tree" when the problem itself is
  about tree traversal/structure — binary trees, BSTs, tree recursion — not because of an
  unrelated tag's typical internal implementation.
- Do NOT infer "Math" from bit-manipulation-only problems unless the problem is actually
  about numeric/counting/combinatorial computation, not bit tricks.
- Respond with ONLY a JSON object: {"tags": ["Label1", "Label2"]}`;

export async function classifyProblem({ title, description, leetcodeTags = [] }) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const cleanDescription = stripHtml(description).slice(0, 3000);
  const tagsLine = leetcodeTags.length > 0
    ? `LeetCode's own topic tags for this problem: ${leetcodeTags.join(', ')}`
    : `LeetCode's own topic tags for this problem: (none)`;

  const response = await axios.post(
    GROQ_URL,
    {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Title: ${title}\n\n${tagsLine}\n\nDescription:\n${cleanDescription || '(no description available)'}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    }
  );

  const raw = response.data?.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('Unexpected Groq response shape');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Groq did not return valid JSON: ${raw}`);
  }

  const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  const valid = tags.filter((t) => VALID_TAGS.includes(t));

  return valid.length > 0 ? valid : ['Other'];
}

export { stripHtml };
