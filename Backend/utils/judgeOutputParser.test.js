import { describe, it, expect } from 'vitest';
import { parseJudgeOutput } from './judgeOutputParser.js';

const tc = (input, output) => ({ input, output });

describe('parseJudgeOutput', () => {
  it('parses a passing scalar result', () => {
    const [result] = parseJudgeOutput('4\n', [tc({ a: 2, b: 2 }, 4)]);
    expect(result).toEqual({ input: { a: 2, b: 2 }, expectedOutput: 4, actualOutput: 4, passed: true });
  });

  it('flags a wrong-answer result as not passed, not an error', () => {
    const [result] = parseJudgeOutput('5\n', [tc({ a: 2, b: 2 }, 4)]);
    expect(result.passed).toBe(false);
    expect(result.actualOutput).toBe(5);
    expect(result.error).toBeUndefined();
  });

  it('matches nested arrays/objects by deep value, not reference', () => {
    const [result] = parseJudgeOutput('[[1,2],[3,4]]\n', [tc({}, [[1, 2], [3, 4]])]);
    expect(result.passed).toBe(true);
  });

  it('parses one line per test case, in order', () => {
    const results = parseJudgeOutput('1\n2\n3\n', [tc({}, 1), tc({}, 2), tc({}, 3)]);
    expect(results.map((r) => r.actualOutput)).toEqual([1, 2, 3]);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('ignores blank lines between test case outputs', () => {
    const results = parseJudgeOutput('1\n\n2\n', [tc({}, 1), tc({}, 2)]);
    expect(results.map((r) => r.actualOutput)).toEqual([1, 2]);
  });

  it('surfaces a __JUDGE_ERROR__ line as a caught error, not a parse failure', () => {
    const [result] = parseJudgeOutput('__JUDGE_ERROR__:java.lang.ArithmeticException: / by zero\n', [tc({}, 1)]);
    expect(result.passed).toBe(false);
    expect(result.actualOutput).toBeNull();
    expect(result.error).toBe('java.lang.ArithmeticException: / by zero');
  });

  it('reports missing output distinctly from a malformed line', () => {
    const [missing] = parseJudgeOutput('', [tc({}, 1)]);
    expect(missing.error).toBe('No output produced for this test case');

    const [malformed] = parseJudgeOutput('not json\n', [tc({}, 1)]);
    expect(malformed.error).toBe('Could not parse output');
    expect(malformed.actualOutput).toBe('not json');
  });

  it('handles one crashed test case without losing the results after it', () => {
    const results = parseJudgeOutput('1\n__JUDGE_ERROR__:boom\n3\n', [tc({}, 1), tc({}, 2), tc({}, 3)]);
    expect(results[0].passed).toBe(true);
    expect(results[1].error).toBe('boom');
    expect(results[2].passed).toBe(true);
  });
});
