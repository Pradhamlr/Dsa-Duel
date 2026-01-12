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
  "Greedy",
  "Binary Search",
  "Sliding Window",
  "Heap",
  "Math",
  "Bit Manipulation",
  "Backtracking"
];

export async function classifyProblem(problem) {
  const text = `
Title: ${problem.title}
Description: ${problem.description}
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
      }
    }
  );

  const { labels, scores } = response.data;

  // Choose tags with confidence > 0.4
  const finalTags = labels.filter((_, i) => scores[i] > 0.4);

  return finalTags.length ? finalTags : ["Other"];
}
