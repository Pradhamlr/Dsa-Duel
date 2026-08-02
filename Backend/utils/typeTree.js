// LeetCode's own type-string grammar, parsed into a small language-agnostic type-tree.
// This has nothing to do with any particular target language (Java, C++, ...) -- it's
// just interpreting strings like "integer[][]" or "list<list<integer>>" into a
// structure any driver's codegen can walk. Extracted out of javaDriverGenerator.js once
// a second consumer (the C++ driver) actually needed it, not preemptively.
//
//   "integer"             -> { kind: 'scalar', base: 'integer' }
//   "integer[][]"         -> { kind: 'array', of: { kind: 'array', of: {scalar integer} } }
//   "list<list<integer>>" -> { kind: 'list', of: { kind: 'list', of: {scalar integer} } }
//   "TreeNode"            -> { kind: 'treenode' }
//   "ListNode"            -> { kind: 'listnode' }
// Anything else (custom classes, class-design shapes, ...) fails to parse and returns
// null -- those remain correctly unsupported, not silently mishandled.
//
// TreeNode/ListNode are terminal leaf kinds, same tier as a scalar -- they carry no
// `base` field (there's only one shape each, unlike scalars which have six). They're
// recognized in the same base-type-name slot a scalar would occupy, which means the
// existing array (`[]`) and list (`list<...>`) wrapping logic already covers
// `TreeNode[]`/`list<ListNode>` etc. for free, without any extra parsing code, should a
// problem ever need that (none in the current catalog do, but nothing here assumes not).

export const KNOWN_SCALAR_TYPES = new Set(['integer', 'long', 'double', 'boolean', 'string', 'character']);
export const KNOWN_NODE_TYPES = new Set(['treenode', 'listnode']);

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

    let node;
    if (KNOWN_SCALAR_TYPES.has(base)) {
      node = { kind: 'scalar', base };
    } else if (KNOWN_NODE_TYPES.has(base)) {
      node = { kind: base };
    } else {
      return null;
    }
    pos += match[0].length;

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

// Deserializes LeetCode's level-order-with-nulls array (e.g. [3,9,20,null,null,15,7])
// into a plain {val,left,right}|null structure. Entirely at codegen time, in JS, not in
// the generated program -- standard BFS: the root consumes vals[0], then each dequeued
// node consumes its next one or two array slots as children, and a `null` slot means
// "no node here", never enqueued (it has no children of its own to assign). Shared by
// both driver generators -- the algorithm has nothing language-specific about it, only
// the literal syntax each one emits from the resulting structure differs.
export function buildTreeStructure(vals) {
  if (!vals || vals.length === 0) return null;
  const root = { val: vals[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length > 0 && i < vals.length) {
    const node = queue.shift();
    if (i < vals.length) {
      const lv = vals[i++];
      if (lv !== null) {
        node.left = { val: lv, left: null, right: null };
        queue.push(node.left);
      }
    }
    if (i < vals.length) {
      const rv = vals[i++];
      if (rv !== null) {
        node.right = { val: rv, left: null, right: null };
        queue.push(node.right);
      }
    }
  }
  return root;
}
