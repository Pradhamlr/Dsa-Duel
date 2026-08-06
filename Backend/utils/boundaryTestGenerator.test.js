import { describe, it, expect } from 'vitest';
import { generateBoundaryTestCases } from './boundaryTestGenerator.js';

const twoSumSignature = {
  name: 'twoSum',
  params: [{ name: 'nums', type: 'integer[]' }, { name: 'target', type: 'integer' }],
  return: { type: 'integer[]' }
};

describe('generateBoundaryTestCases', () => {
  it('produces exactly four scenarios regardless of param count', () => {
    const cases = generateBoundaryTestCases(twoSumSignature);
    expect(cases).toHaveLength(4);
    expect(cases.map((c) => c.label)).toEqual([
      'Empty / zero inputs',
      'Single element',
      'Negative values',
      'Large input'
    ]);
  });

  it('applies the same scenario to every param at once', () => {
    const cases = generateBoundaryTestCases(twoSumSignature);
    const empty = cases.find((c) => c.label === 'Empty / zero inputs');
    expect(empty.input).toEqual({ nums: [], target: 0 });

    const single = cases.find((c) => c.label === 'Single element');
    expect(single.input).toEqual({ nums: [1], target: 1 });

    const negative = cases.find((c) => c.label === 'Negative values');
    expect(negative.input.target).toBe(-7);
    expect(negative.input.nums.every((n) => n < 0)).toBe(true);
  });

  it('generates a large collection of the configured size', () => {
    const cases = generateBoundaryTestCases(twoSumSignature);
    const large = cases.find((c) => c.label === 'Large input');
    expect(large.input.nums).toHaveLength(1000);
    expect(large.input.target).toBeGreaterThan(0);
  });

  it('handles a string scalar param', () => {
    const sig = { name: 'echo', params: [{ name: 's', type: 'string' }], return: { type: 'string' } };
    const cases = generateBoundaryTestCases(sig);
    expect(cases.find((c) => c.label === 'Empty / zero inputs').input.s).toBe('');
    expect(cases.find((c) => c.label === 'Large input').input.s.length).toBe(1000);
  });

  it('handles nested list params', () => {
    const sig = { name: 'flatten', params: [{ name: 'grid', type: 'list<list<integer>>' }], return: { type: 'list<integer>' } };
    const cases = generateBoundaryTestCases(sig);
    expect(cases.find((c) => c.label === 'Empty / zero inputs').input.grid).toEqual([]);
    const single = cases.find((c) => c.label === 'Single element').input.grid;
    expect(single).toHaveLength(1);
    expect(single[0]).toEqual([1]);
  });

  it('produces a flat level-order array for TreeNode/ListNode params, LeetCode-style', () => {
    const sig = { name: 'reverseList', params: [{ name: 'head', type: 'ListNode' }], return: { type: 'ListNode' } };
    const cases = generateBoundaryTestCases(sig);
    expect(cases.find((c) => c.label === 'Empty / zero inputs').input.head).toEqual([]);
    expect(cases.find((c) => c.label === 'Single element').input.head).toEqual([1]);
    expect(cases.find((c) => c.label === 'Large input').input.head).toHaveLength(1000);
  });

  it('returns an empty array for an unparseable signature rather than generating garbage input', () => {
    const sig = { name: 'design', params: [{ name: 'x', type: 'NestedInteger' }], return: { type: 'integer' } };
    expect(generateBoundaryTestCases(sig)).toEqual([]);
  });

  it('returns an empty array for a signature with no params', () => {
    expect(generateBoundaryTestCases({ name: 'noop', params: [], return: { type: 'integer' } })).toEqual([]);
  });
});
