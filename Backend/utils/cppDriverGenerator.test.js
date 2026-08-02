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
  it('accepts TreeNode/ListNode through the C++ driver\'s own import', () => {
    expect(isTypeSupported('TreeNode')).toBe(true);
    expect(isTypeSupported('ListNode')).toBe(true);
    expect(checkSignatureSupported({ params: [{ name: 'head', type: 'ListNode' }], return: { type: 'integer' } }).supported).toBe(true);
  });

  it('still rejects a genuinely unsupported custom class', () => {
    expect(isTypeSupported('NestedInteger')).toBe(false);
  });
});

describe('generateCppProgram -- TreeNode/ListNode', () => {
  const invertTreeSignature = {
    name: 'invertTree',
    params: [{ name: 'root', type: 'TreeNode' }],
    return: { type: 'TreeNode' }
  };

  it('includes the TreeNode and ListNode struct definitions unconditionally', () => {
    const program = generateCppProgram({
      userCode: 'class Solution { public: TreeNode* invertTree(TreeNode* root) { return root; } };',
      functionSignature: invertTreeSignature,
      testCases: [{ input: { root: [1] }, output: [1] }]
    });
    expect(program).toContain('struct TreeNode {');
    expect(program).toContain('struct ListNode {');
  });

  it('maps TreeNode/ListNode to a pointer type', () => {
    const program = generateCppProgram({
      userCode: 'class Solution { public: TreeNode* invertTree(TreeNode* root) { return root; } };',
      functionSignature: invertTreeSignature,
      testCases: [{ input: { root: [1] }, output: [1] }]
    });
    expect(program).toContain('TreeNode* root0 =');
  });

  it('constructs a tree literal at codegen time with new, null gaps as nullptr', () => {
    const program = generateCppProgram({
      userCode: 'class Solution { public: TreeNode* invertTree(TreeNode* root) { return root; } };',
      functionSignature: invertTreeSignature,
      testCases: [{ input: { root: [3, 9, 20, null, null, 15, 7] }, output: [3, 9, 20, null, null, 15, 7] }]
    });
    expect(program).toContain(
      'new TreeNode(3, new TreeNode(9, nullptr, nullptr), new TreeNode(20, new TreeNode(15, nullptr, nullptr), new TreeNode(7, nullptr, nullptr)))'
    );
  });

  it('declares an empty tree input as nullptr', () => {
    const program = generateCppProgram({
      userCode: 'class Solution { public: TreeNode* invertTree(TreeNode* root) { return root; } };',
      functionSignature: invertTreeSignature,
      testCases: [{ input: { root: [] }, output: [] }]
    });
    expect(program).toContain('TreeNode* root0 = nullptr;');
  });

  it('constructs a ListNode literal right-to-left with new', () => {
    const sig = { name: 'reverseList', params: [{ name: 'head', type: 'ListNode' }], return: { type: 'ListNode' } };
    const program = generateCppProgram({
      userCode: 'class Solution { public: ListNode* reverseList(ListNode* head) { return head; } };',
      functionSignature: sig,
      testCases: [{ input: { head: [1, 2, 3] }, output: [1, 2, 3] }]
    });
    expect(program).toContain('new ListNode(1, new ListNode(2, new ListNode(3, nullptr)))');
  });

  it('includes the optional<int>/TreeNode*/ListNode* judgeToJson overloads', () => {
    // Unlike Java, no special-casing is needed at the call site for a tree/list return
    // (auto deduces the concrete pointer type, so there's no Object-style erasure that
    // could lose the "this null means an empty tree" distinction) -- verified with a
    // real g++ run of the empty-tree case before trusting this, not just reasoned about.
    const program = generateCppProgram({
      userCode: 'class Solution { public: TreeNode* invertTree(TreeNode* root) { return root; } };',
      functionSignature: invertTreeSignature,
      testCases: [{ input: { root: [] }, output: [] }]
    });
    expect(program).toContain('auto __result0 = sol.invertTree(root0);');
    expect(program).toContain('string judgeToJson(const optional<int>& v)');
    expect(program).toContain('string judgeToJson(TreeNode* root)');
    expect(program).toContain('string judgeToJson(ListNode* head)');
  });

  it('does not disturb the plain auto-deduction path for a non-tree/list return type', () => {
    const program = generateCppProgram({
      userCode: 'class Solution {};',
      functionSignature: twoSumSignature,
      testCases: [{ input: { nums: [1], target: 1 }, output: [] }]
    });
    expect(program).toContain('auto __result0 = sol.twoSum(nums0, target0);');
  });
});
