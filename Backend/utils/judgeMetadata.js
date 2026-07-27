// Verified live against real problems before writing this (see CLAUDE.md /
// CONTEST_SOLVING_ARCHITECTURE.md): metaData.manual only flags SQL-style problems, NOT
// class-design ones -- LRU Cache and Design Twitter both have manual: undefined. Class-
// design problems are reliably identified by metaData.classname being present (LRU Cache's
// metaData even has top-level params/return too, describing the whole call-sequence shape,
// so checking for params/return alone is not sufficient -- classname is the real signal).
export function isJudgeSupported(metaData, codeSnippets) {
  if (!metaData) return false;
  if (metaData.classname) return false; // class-design problem (LRU Cache, Design Twitter, ...)
  if (metaData.manual === true) return false; // SQL / other non-function-call problem
  if (!codeSnippets?.java || !codeSnippets?.cpp) return false; // need real starter code for both
  if (!Array.isArray(metaData.params) || !metaData.return) return false;
  return true;
}

const tryParseJSON = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// LeetCode's exampleTestcases is a flat, newline-delimited list: every N lines (N = number
// of params) is one test case, in the exact order metaData.params defines. Each line is
// itself valid JSON (arrays/numbers/strings), so no custom parsing beyond JSON.parse.
export function parseExampleTestcases(raw, params) {
  if (!raw || !Array.isArray(params) || params.length === 0) return [];

  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const testCases = [];

  for (let i = 0; i + params.length <= lines.length; i += params.length) {
    const input = {};
    for (let j = 0; j < params.length; j++) {
      input[params[j].name] = tryParseJSON(lines[i + j]);
    }
    testCases.push(input);
  }

  return testCases;
}

const decodeHtmlEntities = (str) => str
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .trim();

// Two known HTML shapes for an example's Output line across the catalog:
//   <strong>Output:</strong> [0,1]                                  (older <pre>-block style)
//   <strong>Output:</strong> <span class="example-io">964176192</span>  (newer <p>+span style)
// This matches both: an optional <span ...> wrapper, then captures up to the next tag/newline.
const OUTPUT_REGEX = /<strong>\s*Output:?\s*<\/strong>\s*(?:<span[^>]*>)?\s*([^<\n]+)/gi;

export function extractOutputsFromContent(content) {
  if (!content) return [];
  const outputs = [];
  OUTPUT_REGEX.lastIndex = 0;
  let match;
  while ((match = OUTPUT_REGEX.exec(content)) !== null) {
    outputs.push(decodeHtmlEntities(match[1]));
  }
  return outputs;
}

// Pairs LeetCode's structured example inputs with outputs extracted from the description
// prose, positionally. If exampleTestcases has more entries than the description shows
// visible outputs for, the extras are dropped -- there's no ground truth to check them
// against, so guessing would be worse than not having that test case at all.
export function buildTestCases(metaData, exampleTestcasesRaw, content) {
  const params = metaData?.params || [];
  const inputs = parseExampleTestcases(exampleTestcasesRaw, params);
  const outputs = extractOutputsFromContent(content);

  const testCases = [];
  const count = Math.min(inputs.length, outputs.length);
  for (let i = 0; i < count; i++) {
    testCases.push({ input: inputs[i], output: tryParseJSON(outputs[i]) });
  }
  return testCases;
}
