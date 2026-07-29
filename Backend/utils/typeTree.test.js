import { describe, it, expect } from 'vitest';
import { parseType, isTypeSupported, checkSignatureSupported } from './typeTree.js';

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

  it('rejects an unknown base type', () => {
    expect(parseType('TreeNode')).toBeNull();
    expect(parseType('ListNode')).toBeNull();
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
  });

  it('is false for anything parseType rejects', () => {
    expect(isTypeSupported('TreeNode')).toBe(false);
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

  it('collects every unsupported type, deduplicated', () => {
    const result = checkSignatureSupported({
      params: [{ name: 'root', type: 'TreeNode' }, { name: 'other', type: 'TreeNode' }],
      return: { type: 'ListNode' }
    });
    expect(result.supported).toBe(false);
    expect(result.unsupportedTypes.sort()).toEqual(['ListNode', 'TreeNode']);
  });

  it('treats a missing params array as zero params', () => {
    const result = checkSignatureSupported({ return: { type: 'integer' } });
    expect(result.supported).toBe(true);
  });
});
