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

    let chosen = sorted
      .filter(p => p.score > 0.4)
      .slice(0, 2)
      .map(p => p.label);

    // Fallback: if none passed threshold, take the best one
    if (chosen.length === 0) {
      chosen = [sorted[0].label];
    }

    // Map descriptive labels to canonical tags
    const canonicalTags = chosen
      .map(label => LABEL_MAP[label])
      .filter(Boolean);

    return canonicalTags;
  }

  // Case: MNLI format
  while (Array.isArray(data)) data = data[0];

  if (data.labels && data.scores) {
    const paired = data.labels.map((label, i) => ({
      label,
      score: data.scores[i]
    })).sort((a, b) => b.score - a.score);

    let chosen = paired
      .filter(p => p.score > 0.35)
      .slice(0, 2)
      .map(p => p.label);

    // Fallback: if none passed threshold, take the best one
    if (chosen.length === 0) {
      chosen = [paired[0].label];
    }

    // Map descriptive labels to canonical tags
    const canonicalTags = chosen
      .map(label => LABEL_MAP[label])
      .filter(Boolean);

    return canonicalTags;
  }

  throw new Error("Unsupported Hugging Face response format");
}
