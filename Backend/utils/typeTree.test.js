import { describe, it, expect } from 'vitest';
import { parseType, isTypeSupported, checkSignatureSupported, buildTreeStructure } from './typeTree.js';

describe('parseType', () => {
  it('parses a bare scalar', () => {
    expect(parseType('integer')).toEqual({ kind: 'scalar', base: 'integer' });
  });

  it('parses each known scalar type', () => {
    expect(parseType('long')).toEqual({ kind: 'scalar', base: 'long' });
    expect(parseType('double')).toEqual({ kind: 'scalar', base: 'double' });
    expect(parseType('boolean')).toEqual({ kind: 'scalar', base: 'boolean' });
    expect(parseType('string')).toEqual({ kind: 'scalar', base: 'string' });
    expect(parseType('character')).toEqual({ kind: 'scalar', base: 'character' });
  });

  it('is case-insensitive on the base type name', () => {
    expect(parseType('Integer')).toEqual({ kind: 'scalar', base: 'integer' });
    expect(parseType('STRING')).toEqual({ kind: 'scalar', base: 'string' });
  });

  it('parses a single-dimension array', () => {
    expect(parseType('integer[]')).toEqual({
      kind: 'array',
      of: { kind: 'scalar', base: 'integer' }
    });
  });

  it('parses a nested array', () => {
    expect(parseType('integer[][]')).toEqual({
      kind: 'array',
      of: { kind: 'array', of: { kind: 'scalar', base: 'integer' } }
    });
  });

  it('parses a list of scalar', () => {
    expect(parseType('list<integer>')).toEqual({
      kind: 'list',
      of: { kind: 'scalar', base: 'integer' }
    });
  });

  it('parses a nested list', () => {
    expect(parseType('list<list<integer>>')).toEqual({
      kind: 'list',
      of: { kind: 'list', of: { kind: 'scalar', base: 'integer' } }
    });
  });

  it('parses a list of arrays', () => {
    expect(parseType('list<integer[]>')).toEqual({
      kind: 'list',
      of: { kind: 'array', of: { kind: 'scalar', base: 'integer' } }
    });
  });

  it('parses TreeNode and ListNode as terminal leaf kinds', () => {
    expect(parseType('TreeNode')).toEqual({ kind: 'treenode' });
    expect(parseType('ListNode')).toEqual({ kind: 'listnode' });
    // Case-insensitive, same as scalars.
    expect(parseType('treenode')).toEqual({ kind: 'treenode' });
  });

  it('TreeNode/ListNode compose with array and list wrapping for free', () => {
    // No LeetCode problem in the real catalog needs this, but the parser doesn't special-
    // case it away either -- treenode/listnode occupy the same base-type-name slot a
    // scalar does, so the existing []/list<> wrapping logic already covers it.
    expect(parseType('TreeNode[]')).toEqual({ kind: 'array', of: { kind: 'treenode' } });
    expect(parseType('list<TreeNode>')).toEqual({ kind: 'list', of: { kind: 'treenode' } });
  });

  it('rejects an unknown base type', () => {
    expect(parseType('CustomClass')).toBeNull();
    expect(parseType('NestedInteger')).toBeNull();
  });

  it('rejects malformed generic syntax', () => {
    expect(parseType('list<integer')).toBeNull();
    expect(parseType('list integer>')).toBeNull();
  });

  it('rejects trailing garbage after a valid type', () => {
    expect(parseType('integer garbage')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(parseType(null)).toBeNull();
    expect(parseType(undefined)).toBeNull();
    expect(parseType(42)).toBeNull();
  });

  it('ignores whitespace', () => {
    expect(parseType(' list< integer > ')).toEqual({
      kind: 'list',
      of: { kind: 'scalar', base: 'integer' }
    });
  });
});

describe('isTypeSupported', () => {
  it('is true for anything parseType accepts', () => {
    expect(isTypeSupported('integer[][]')).toBe(true);
    expect(isTypeSupported('list<string>')).toBe(true);
    expect(isTypeSupported('TreeNode')).toBe(true);
    expect(isTypeSupported('ListNode')).toBe(true);
  });

  it('is false for anything parseType rejects', () => {
    expect(isTypeSupported('CustomClass')).toBe(false);
  });
});

describe('checkSignatureSupported', () => {
  it('reports supported when every param and the return type parse', () => {
    const result = checkSignatureSupported({
      params: [{ name: 'nums', type: 'integer[]' }, { name: 'target', type: 'integer' }],
      return: { type: 'integer[]' }
    });
    expect(result).toEqual({ supported: true, unsupportedTypes: [] });
  });

  it('treats TreeNode/ListNode params and return types as supported', () => {
    const result = checkSignatureSupported({
      params: [{ name: 'root', type: 'TreeNode' }],
      return: { type: 'TreeNode' }
    });
    expect(result).toEqual({ supported: true, unsupportedTypes: [] });
  });

  it('collects every unsupported type, deduplicated', () => {
    const result = checkSignatureSupported({
      params: [{ name: 'a', type: 'CustomClass' }, { name: 'b', type: 'CustomClass' }],
      return: { type: 'NestedInteger' }
    });
    expect(result.supported).toBe(false);
    expect(result.unsupportedTypes.sort()).toEqual(['CustomClass', 'NestedInteger']);
  });

  it('treats a missing params array as zero params', () => {
    const result = checkSignatureSupported({ return: { type: 'integer' } });
    expect(result.supported).toBe(true);
  });
});

describe('buildTreeStructure', () => {
  it('returns null for an empty array', () => {
    expect(buildTreeStructure([])).toBeNull();
  });

  it('builds a single-node tree', () => {
    expect(buildTreeStructure([1])).toEqual({ val: 1, left: null, right: null });
  });

  it('builds a complete tree with no gaps', () => {
    // [4,2,7,1,3,6,9] -- verified by hand against a real invertTree example before
    // trusting this: 4's children 2,7; 2's children 1,3; 7's children 6,9.
    expect(buildTreeStructure([4, 2, 7, 1, 3, 6, 9])).toEqual({
      val: 4,
      left: { val: 2, left: { val: 1, left: null, right: null }, right: { val: 3, left: null, right: null } },
      right: { val: 7, left: { val: 6, left: null, right: null }, right: { val: 9, left: null, right: null } }
    });
  });

  it('treats a null slot as "no node", never enqueuing it for further children', () => {
    // [3,9,20,null,null,15,7] -- the real maxDepth/levelOrder example. 9 and 20 are 3's
    // children; 9 is a leaf (both its slots are null); 15,7 are 20's children.
    expect(buildTreeStructure([3, 9, 20, null, null, 15, 7])).toEqual({
      val: 3,
      left: { val: 9, left: null, right: null },
      right: {
        val: 20,
        left: { val: 15, left: null, right: null },
        right: { val: 7, left: null, right: null }
      }
    });
  });

  it('handles a right-only child correctly', () => {
    // [1,null,2] -- root 1 has no left child, only a right child 2.
    expect(buildTreeStructure([1, null, 2])).toEqual({
      val: 1,
      left: null,
      right: { val: 2, left: null, right: null }
    });
  });
});
