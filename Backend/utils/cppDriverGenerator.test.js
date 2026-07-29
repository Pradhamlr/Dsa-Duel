import { describe, it, expect } from 'vitest';
import { generateCppProgram, isTypeSupported, checkSignatureSupported } from './cppDriverGenerator.js';

const twoSumSignature = {
  name: 'twoSum',
  params: [{ name: 'nums', type: 'integer[]' }, { name: 'target', type: 'integer' }],
  return: { type: 'integer[]' }
};

describe('generateCppProgram', () => {
  it('embeds the user\'s Solution class verbatim', () => {
    const program = generateCppProgram({
      userCode: 'class Solution { public: vector<int> twoSum(vector<int>& nums, int target) { return {0,1}; } };',
      functionSignature: twoSumSignature,
      testCases: [{ input: { nums: [2, 7, 11, 15], target: 9 }, output: [0, 1] }]
    });
    expect(program).toContain('class Solution { public: vector<int> twoSum');
  });

  it('maps an "array" type-tree kind to vector<T>, same as "list"', () => {
    const program = generateCppProgram({
      userCode: 'class Solution {};',
      functionSignature: twoSumSignature,
      testCases: [{ input: { nums: [2, 7, 11, 15], target: 9 }, output: [0, 1] }]
    });
    expect(program).toContain('vector<int> nums0 = {2, 7, 11, 15};');
    expect(program).toContain('int target0 = 9;');
  });

  it('nests brace-init uniformly for a nested list, no boxed-type wrinkle', () => {
    const listSig = {
      name: 'flatten',
      params: [{ name: 'grid', type: 'list<list<integer>>' }],
      return: { type: 'list<integer>' }
    };
    const program = generateCppProgram({
      userCode: 'class Solution {};',
      functionSignature: listSig,
      testCases: [{ input: { grid: [[1, 2], [3]] }, output: [1, 2, 3] }]
    });
    expect(program).toContain('vector<vector<int>> grid0 = {{1, 2}, {3}};');
  });

  it('escapes embedded quotes and backslashes in string literals', () => {
    const sig = { name: 'echo', params: [{ name: 's', type: 'string' }], return: { type: 'string' } };
    const program = generateCppProgram({
      userCode: 'class Solution {};',
      functionSignature: sig,
      testCases: [{ input: { s: 'a"b\\c' }, output: 'a"b\\c' }]
    });
    expect(program).toContain('string s0 = "a\\"b\\\\c";');
  });

  it('gives long its own LL-suffixed literal', () => {
    const sig = { name: 'echo', params: [{ name: 'n', type: 'long' }], return: { type: 'long' } };
    const program = generateCppProgram({
      userCode: 'class Solution {};',
      functionSignature: sig,
      testCases: [{ input: { n: 5000000000 }, output: 5000000000 }]
    });
    expect(program).toContain('long long n0 = 5000000000LL;');
  });

  it('wraps each test case in std::exception + catch-all so a crash on one case is isolated', () => {
    const program = generateCppProgram({
      userCode: 'class Solution {};',
      functionSignature: twoSumSignature,
      testCases: [
        { input: { nums: [1], target: 1 }, output: [] },
        { input: { nums: [2], target: 2 }, output: [] }
      ]
    });
    expect(program.match(/catch \(const std::exception& e\)/g)).toHaveLength(2);
    expect(program.match(/catch \(\.\.\.\)/g)).toHaveLength(2);
  });

  it('includes the bits/stdc++.h umbrella header and the overloaded print helpers once', () => {
    const program = generateCppProgram({
      userCode: 'class Solution {};',
      functionSignature: twoSumSignature,
      testCases: [{ input: { nums: [1], target: 1 }, output: [] }]
    });
    expect(program).toContain('#include <bits/stdc++.h>');
    expect(program.match(/string judgeToJson\(int v\)/g)).toHaveLength(1);
    expect(program.match(/template <typename T>\nstring judgeToJson\(const vector<T>& v\)/g)).toHaveLength(1);
  });
});

describe('isTypeSupported / checkSignatureSupported re-export', () => {
  it('still rejects TreeNode/ListNode through the C++ driver\'s own import', () => {
    expect(isTypeSupported('ListNode')).toBe(false);
    expect(checkSignatureSupported({ params: [{ name: 'head', type: 'ListNode' }], return: { type: 'integer' } }).supported).toBe(false);
  });
});
