// Parses a judge program's stdout back into per-test-case results. Entirely
// language-agnostic: every driver (Java, C++, ...) emits the exact same wire format --
// one line per test case, either a JSON-encoded result or a "__JUDGE_ERROR__:"-prefixed
// line for a caught exception -- so there's nothing to duplicate per language here.
// Extracted the same way parseType/typeTree.js was: once a second driver actually
// needed the exact same logic, not preemptively.
export function parseJudgeOutput(stdout, testCases) {
  const lines = (stdout || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  return testCases.map((tc, i) => {
    const line = lines[i];
    if (line === undefined) {
      return { input: tc.input, expectedOutput: tc.output, actualOutput: null, passed: false, error: 'No output produced for this test case' };
    }
    if (line.startsWith('__JUDGE_ERROR__:')) {
      return { input: tc.input, expectedOutput: tc.output, actualOutput: null, passed: false, error: line.slice('__JUDGE_ERROR__:'.length) };
    }
    let actual;
    try {
      actual = JSON.parse(line);
    } catch {
      return { input: tc.input, expectedOutput: tc.output, actualOutput: line, passed: false, error: 'Could not parse output' };
    }
    const passed = JSON.stringify(actual) === JSON.stringify(tc.output);
    return { input: tc.input, expectedOutput: tc.output, actualOutput: actual, passed };
  });
}
