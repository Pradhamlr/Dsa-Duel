import { describe, it, expect } from 'vitest';
import { generateJavaProgram, isTypeSupported, checkSignatureSupported } from './javaDriverGenerator.js';

const twoSumSignature = {
  name: 'twoSum',
  params: [{ name: 'nums', type: 'integer[]' }, { name: 'target', type: 'integer' }],
  return: { type: 'integer[]' }
};

describe('generateJavaProgram', () => {
  it('embeds the user\'s Solution class verbatim', () => {
    const program = generateJavaProgram({
      userCode: 'class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{0,1}; } }',
      functionSignature: twoSumSignature,
      testCases: [{ input: { nums: [2, 7, 11, 15], target: 9 }, output: [0, 1] }]
    });
    expect(program).toContain('class Solution { public int[] twoSum(int[] nums, int target)');
  });

  it('declares a primitive array parameter with a Java array literal', () => {
    const program = generateJavaProgram({
      userCode: 'class Solution {}',
      functionSignature: twoSumSignature,
      testCases: [{ input: { nums: [2, 7, 11, 15], target: 9 }, output: [0, 1] }]
    });
    expect(program).toContain('int[] nums0 = new int[]{2,7,11,15};');
    expect(program).toContain('int target0 = 9;');
  });

  it('boxes scalar elements inside a List<T> but not arrays or nested lists', () => {
    const listSig = {
      name: 'flatten',
      params: [{ name: 'grid', type: 'list<list<integer>>' }],
      return: { type: 'list<integer>' }
    };
    const program = generateJavaProgram({
      userCode: 'class Solution {}',
      functionSignature: listSig,
      testCases: [{ input: { grid: [[1, 2], [3]] }, output: [1, 2, 3] }]
    });
    expect(program).toContain('List<List<Integer>> grid0');
    expect(program).toContain('new ArrayList<>(Arrays.asList(new ArrayList<>(Arrays.asList(1, 2)), new ArrayList<>(Arrays.asList(3))))');
  });

  it('escapes embedded quotes and backslashes in string literals', () => {
    const sig = { name: 'echo', params: [{ name: 's', type: 'string' }], return: { type: 'string' } };
    const program = generateJavaProgram({
      userCode: 'class Solution {}',
      functionSignature: sig,
      testCases: [{ input: { s: 'a"b\\c' }, output: 'a"b\\c' }]
    });
    expect(program).toContain('String s0 = "a\\"b\\\\c";');
  });

  it('wraps each test case in its own try/catch so one exception doesn\'t stop the others', () => {
    const program = generateJavaProgram({
      userCode: 'class Solution {}',
      functionSignature: twoSumSignature,
      testCases: [
        { input: { nums: [1], target: 1 }, output: [] },
        { input: { nums: [2], target: 2 }, output: [] }
      ]
    });
    expect(program.match(/catch \(Exception e\)/g)).toHaveLength(2);
    expect(program).toContain('nums0');
    expect(program).toContain('nums1');
  });

  it('includes the reflection-based JSON printer once regardless of test case count', () => {
    const program = generateJavaProgram({
      userCode: 'class Solution {}',
      functionSignature: twoSumSignature,
      testCases: [{ input: { nums: [1], target: 1 }, output: [] }]
    });
    expect(program.match(/__judgeToJson/g).length).toBeGreaterThan(1);
    expect(program.match(/static String __judgeToJson/g)).toHaveLength(1);
  });
});

describe('isTypeSupported / checkSignatureSupported re-export', () => {
  it('accepts TreeNode/ListNode through the Java driver\'s own import', () => {
    expect(isTypeSupported('TreeNode')).toBe(true);
    expect(isTypeSupported('ListNode')).toBe(true);
    expect(checkSignatureSupported({ params: [{ name: 'root', type: 'TreeNode' }], return: { type: 'integer' } }).supported).toBe(true);
  });

  it('still rejects a genuinely unsupported custom class', () => {
    expect(isTypeSupported('NestedInteger')).toBe(false);
  });
});

describe('generateJavaProgram -- TreeNode/ListNode', () => {
  const invertTreeSignature = {
    name: 'invertTree',
    params: [{ name: 'root', type: 'TreeNode' }],
    return: { type: 'TreeNode' }
  };

  it('includes the TreeNode and ListNode class definitions unconditionally', () => {
    // Unconditional even for a problem that only uses one of them -- JSON_HELPER's
    // instanceof checks reference both class names regardless of which problem it's
    // bundled with, so both always need to be compilable.
    const program = generateJavaProgram({
      userCode: 'class Solution { public TreeNode invertTree(TreeNode root) { return root; } }',
      functionSignature: invertTreeSignature,
      testCases: [{ input: { root: [1] }, output: [1] }]
    });
    expect(program).toContain('class TreeNode {');
    expect(program).toContain('class ListNode {');
  });

  it('constructs a tree literal at codegen time, with null gaps preserved', () => {
    const program = generateJavaProgram({
      userCode: 'class Solution { public TreeNode invertTree(TreeNode root) { return root; } }',
      functionSignature: invertTreeSignature,
      testCases: [{ input: { root: [3, 9, 20, null, null, 15, 7] }, output: [3, 9, 20, null, null, 15, 7] }]
    });
    expect(program).toContain(
      'new TreeNode(3, new TreeNode(9, null, null), new TreeNode(20, new TreeNode(15, null, null), new TreeNode(7, null, null)))'
    );
  });

  it('declares an empty tree input as a null TreeNode reference', () => {
    const program = generateJavaProgram({
      userCode: 'class Solution { public TreeNode invertTree(TreeNode root) { return root; } }',
      functionSignature: invertTreeSignature,
      testCases: [{ input: { root: [] }, output: [] }]
    });
    expect(program).toContain('TreeNode root0 = null;');
  });

  it('constructs a ListNode literal right-to-left', () => {
    const sig = { name: 'reverseList', params: [{ name: 'head', type: 'ListNode' }], return: { type: 'ListNode' } };
    const program = generateJavaProgram({
      userCode: 'class Solution { public ListNode reverseList(ListNode head) { return head; } }',
      functionSignature: sig,
      testCases: [{ input: { head: [1, 2, 3] }, output: [1, 2, 3] }]
    });
    expect(program).toContain('new ListNode(1, new ListNode(2, new ListNode(3, null)))');
  });

  it('keeps a tree/list return type\'s concrete class through to the print step, not erased to Object', () => {
    // The real bug this guards against: erasing to `Object __result0` loses the one bit
    // of information (this null means an empty tree) needed to print an empty result as
    // "[]" rather than the literal text "null" -- caught by a real javac/java run before
    // this test was written, not just reasoned about.
    const program = generateJavaProgram({
      userCode: 'class Solution { public TreeNode invertTree(TreeNode root) { return root; } }',
      functionSignature: invertTreeSignature,
      testCases: [{ input: { root: [] }, output: [] }]
    });
    expect(program).toContain('TreeNode __result0 = sol.invertTree(root0);');
    expect(program).toContain('__judgeToJson(__serializeTree(__result0))');
    expect(program).not.toContain('Object __result0');
  });

  it('routes a ListNode return through __serializeList the same way', () => {
    const sig = { name: 'reverseList', params: [{ name: 'head', type: 'ListNode' }], return: { type: 'ListNode' } };
    const program = generateJavaProgram({
      userCode: 'class Solution { public ListNode reverseList(ListNode head) { return head; } }',
      functionSignature: sig,
      testCases: [{ input: { head: [] }, output: [] }]
    });
    expect(program).toContain('ListNode __result0 = sol.reverseList(head0);');
    expect(program).toContain('__judgeToJson(__serializeList(__result0))');
  });

  it('does not disturb the Object-erasure path for a non-tree/list return type', () => {
    const program = generateJavaProgram({
      userCode: 'class Solution {}',
      functionSignature: twoSumSignature,
      testCases: [{ input: { nums: [1], target: 1 }, output: [] }]
    });
    expect(program).toContain('Object __result0 = sol.twoSum(nums0, target0);');
  });
});
