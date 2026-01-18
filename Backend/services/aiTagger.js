import axios from "axios";

const HF_URL = "https://router.huggingface.co/hf-inference/models/MoritzLaurer/deberta-v3-base-zeroshot-v2.0";

const TAG_LABELS = [
  "Array manipulation problem",
  "String processing problem",
  "Hashing / frequency counting problem",
  "Stack-based problem",
  "Queue-based problem",
  "Linked list problem",
  "Tree traversal / tree algorithm",
  "Graph traversal / graph algorithm",
  "Dynamic programming problem",
  "Binary search on sorted data",
  "Two pointers technique",
  "Matrix / grid traversal",
  "Mathematical calculation problem",
  "SQL / database aggregation problem"
];

const LABEL_MAP = {
  "Array manipulation problem": "Array",
  "String processing problem": "String",
  "Hashing / frequency counting problem": "Hashing",
  "Stack-based problem": "Stack",
  "Queue-based problem": "Queue",
  "Linked list problem": "LinkedList",
  "Tree traversal / tree algorithm": "Tree",
  "Graph traversal / graph algorithm": "Graph",
  "Dynamic programming problem": "DP",
  "Binary search on sorted data": "BinarySearch",
  "Two pointers technique": "TwoPointers",
  "Matrix / grid traversal": "Matrix",
  "Mathematical calculation problem": "Math",
  "SQL / database aggregation problem": "Database"
};

// Confidence threshold - only accept AI predictions with strong confidence
const CONFIDENT_THRESHOLD = 0.45;

export async function classifyProblem(problem) {
  if (!process.env.HF_API_KEY) {
    throw new Error("HF_API_KEY not configured");
  }

  const text = `
    This is a competitive programming problem from LeetCode.
    Classify it based on the main algorithmic technique used to solve it.

    Do NOT classify by domain words.
    Classify by how the problem is solved (data structures / algorithm strategy).

    Problem:
    Title: ${problem.title}
    Description: ${problem.description || ""}
    Constraints: ${problem.constraints || ""}
    `;

  const response = await axios.post(
    HF_URL,
    {
      inputs: text,
      parameters: {
        candidate_labels: TAG_LABELS,
        multi_label: true
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 20000
    }
  );

  console.log("HF RAW RESPONSE:", JSON.stringify(response.data, null, 2));

   let data = response.data;

  // Case: array of {label, score}
  if (Array.isArray(data) && data[0]?.label && data[0]?.score !== undefined) {
    const sorted = data.sort((a, b) => b.score - a.score);
    const best = sorted[0];

    // Log for debugging
    console.log("AI Scores:", sorted.map(s => ({
      label: s.label,
      score: s.score.toFixed(3)
    })));

    // If model is confident → accept
    if (best.score >= CONFIDENT_THRESHOLD) {
      const tag = LABEL_MAP[best.label];
      if (!tag) {
        return ["Other"];
      }
      return [tag];
    }

    // Otherwise → AI is unsure → reject
    console.log(`AI abstained: best score ${best.score.toFixed(3)} < threshold ${CONFIDENT_THRESHOLD}`);
    return ["Other"];
  }

  // Case: MNLI format
  while (Array.isArray(data)) data = data[0];

  if (data.labels && data.scores) {
    const paired = data.labels.map((label, i) => ({
      label,
      score: data.scores[i]
    })).sort((a, b) => b.score - a.score);
    
    const best = paired[0];

    // Log for debugging
    console.log("AI Scores:", paired.map(s => ({
      label: s.label,
      score: s.score.toFixed(3)
    })));

    // If model is confident → accept
    if (best.score >= CONFIDENT_THRESHOLD) {
      const tag = LABEL_MAP[best.label];
      if (!tag) {
        return ["Other"];
      }
      return [tag];
    }

    // Otherwise → AI is unsure → reject
    console.log(`AI abstained: best score ${best.score.toFixed(3)} < threshold ${CONFIDENT_THRESHOLD}`);
    return ["Other"];
  }

  throw new Error("Unsupported Hugging Face response format");
}
