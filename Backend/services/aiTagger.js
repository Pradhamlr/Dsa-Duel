import axios from "axios";

const HF_URL =
  "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli";

const TAG_LABELS = [
  "Array",
  "String",
  "Hashing",
  "Stack",
  "Queue",
  "LinkedList",
  "Tree",
  "Graph",
  "DP",
  "BinarySearch",
  "TwoPointers",
  "Matrix"
];

export async function classifyProblem(problem) {
  if (!process.env.HF_API_KEY) {
    throw new Error("HF_API_KEY not configured");
  }

  const text = `
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

    let top = sorted
      .filter(p => p.score > 0.35)
      .map(p => p.label);

      top = top.slice(0, 2);

    // Fallback: if none passed threshold, take the best one
    if (top.length === 0) {
    top = [sorted[0].label];
    }

    return top;
  }

  // Case: MNLI format
  while (Array.isArray(data)) data = data[0];

  if (data.labels && data.scores) {
    const paired = data.labels.map((label, i) => ({
      label,
      score: data.scores[i]
    })).sort((a, b) => b.score - a.score);

    const strong = paired.filter(p => p.score > 0.35).map(p => p.label);
    return strong.length ? strong : [paired[0].label];
  }

  throw new Error("Unsupported Hugging Face response format");
}
