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

// Boundary/stress cases (see boundaryTestGenerator.js) have no expected output to
// compare against -- there's no reference solution, only a synthetic edge-case input.
// So this checks for a crash on this specific case (a caught runtime exception, or a
// print step that never produced a parseable line) rather than correctness. Same wire
// format, deliberately not reusing parseJudgeOutput's `passed` field here -- that name
// implies a correctness verdict this data was never meant to carry.
export function parseStressTestOutput(stdout, testCases) {
  const lines = (stdout || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  return testCases.map((tc, i) => {
    const line = lines[i];
    if (line === undefined) {
      return { label: tc.label, input: tc.input, actualOutput: null, crashed: true, error: 'No output produced for this test case' };
    }
    if (line.startsWith('__JUDGE_ERROR__:')) {
      return { label: tc.label, input: tc.input, actualOutput: null, crashed: true, error: line.slice('__JUDGE_ERROR__:'.length) };
    }
    try {
      const actual = JSON.parse(line);
      return { label: tc.label, input: tc.input, actualOutput: actual, crashed: false };
    } catch {
      return { label: tc.label, input: tc.input, actualOutput: line, crashed: true, error: 'Could not parse output' };
    }
  });
}
