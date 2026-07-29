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
  it('still rejects TreeNode/ListNode through the Java driver\'s own import', () => {
    expect(isTypeSupported('TreeNode')).toBe(false);
    expect(checkSignatureSupported({ params: [{ name: 'root', type: 'TreeNode' }], return: { type: 'integer' } }).supported).toBe(false);
  });
});
