// LeetCode's own type-string grammar, parsed into a small language-agnostic type-tree.
// This has nothing to do with any particular target language (Java, C++, ...) -- it's
// just interpreting strings like "integer[][]" or "list<list<integer>>" into a
// structure any driver's codegen can walk. Extracted out of javaDriverGenerator.js once
// a second consumer (the C++ driver) actually needed it, not preemptively.
//
//   "integer"             -> { kind: 'scalar', base: 'integer' }
//   "integer[][]"         -> { kind: 'array', of: { kind: 'array', of: {scalar integer} } }
//   "list<list<integer>>" -> { kind: 'list', of: { kind: 'list', of: {scalar integer} } }
// Anything else (TreeNode, ListNode, custom classes, ...) fails to parse and returns
// null -- those remain correctly unsupported, not silently mishandled.

export const KNOWN_SCALAR_TYPES = new Set(['integer', 'long', 'double', 'boolean', 'string', 'character']);

// Recursive-descent parser -- see the module comment above for the shape it produces.
export function parseType(leetcodeType) {
  if (typeof leetcodeType !== 'string') return null;
  const input = leetcodeType.trim().replace(/\s+/g, '');
  let pos = 0;

  function parseOne() {
    if (input.slice(pos, pos + 5).toLowerCase() === 'list<') {
      pos += 5;
      const inner = parseOne();
      if (!inner || input[pos] !== '>') return null;
      pos += 1;
      return { kind: 'list', of: inner };
    }

    const match = /^[a-zA-Z]+/.exec(input.slice(pos));
    if (!match) return null;
    const base = match[0].toLowerCase();
    if (!KNOWN_SCALAR_TYPES.has(base)) return null;
    pos += match[0].length;

    let node = { kind: 'scalar', base };
    while (input.slice(pos, pos + 2) === '[]') {
      pos += 2;
      node = { kind: 'array', of: node };
    }
    return node;
  }

  const parsed = parseOne();
  return parsed && pos === input.length ? parsed : null;
}

export function isTypeSupported(leetcodeType) {
  return parseType(leetcodeType) !== null;
}

// Checks every param + the return type against the supported type set. Problems whose
// signature includes something no driver handles (TreeNode, ListNode, custom classes)
// should be rejected clearly up front, not attempted and left to fail with a confusing
// compile error deep inside Judge0. Language-agnostic -- shared by every driver.
export function checkSignatureSupported(functionSignature) {
  const params = functionSignature?.params || [];
  const unsupported = [];

  for (const p of params) {
    if (!isTypeSupported(p.type)) unsupported.push(p.type);
  }
  if (!isTypeSupported(functionSignature?.return?.type)) {
    unsupported.push(functionSignature?.return?.type);
  }

  return { supported: unsupported.length === 0, unsupportedTypes: [...new Set(unsupported)] };
}
