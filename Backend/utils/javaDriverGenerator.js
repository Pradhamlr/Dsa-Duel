// Turns a user's submitted Solution class + a problem's parsed test cases into one
// runnable Java program: declare each test case's inputs with the exact types LeetCode's
// metaData describes, call the user's method, print the result, repeat per test case.
//
// Output printing deliberately does NOT special-case per return type. A single generic
// helper (__judgeToJson, via reflection) prints ints/booleans/Strings/arbitrarily-nested
// arrays alike -- much simpler and more robust than generating bespoke print code per
// type/dimension combination. Only the INPUT side needs type-specific code, since Java
// requires explicit typed variable declarations for method arguments.
//
// The type-tree parsing (parseType/isTypeSupported/checkSignatureSupported) lives in
// ./typeTree.js -- it's LeetCode's own type-string grammar, nothing Java-specific about
// it, and this driver is no longer the only consumer (see cppDriverGenerator.js).

import { parseType, isTypeSupported, checkSignatureSupported, buildTreeStructure } from './typeTree.js';

export { isTypeSupported, checkSignatureSupported };

const PRIMITIVE_JAVA_TYPES = {
  integer: 'int',
  long: 'long',
  double: 'double',
  boolean: 'boolean',
  string: 'String',
  character: 'char'
};

// Java generics can't take a primitive as a type argument (List<int> is illegal --
// List<Integer> is required), so list-of-scalar needs the boxed name instead.
const BOXED_JAVA_TYPES = {
  integer: 'Integer',
  long: 'Long',
  double: 'Double',
  boolean: 'Boolean',
  string: 'String',
  character: 'Character'
};

function javaTypeForNode(node) {
  if (node.kind === 'scalar') return PRIMITIVE_JAVA_TYPES[node.base];
  if (node.kind === 'treenode') return 'TreeNode';
  if (node.kind === 'listnode') return 'ListNode';
  if (node.kind === 'array') return `${javaTypeForNode(node.of)}[]`;
  return `List<${javaGenericArgFor(node.of)}>`;
}

// Same as javaTypeForNode but boxes a bare scalar type argument -- arrays and nested
// Lists are already reference types, so those pass through javaTypeForNode unboxed.
function javaGenericArgFor(node) {
  return node.kind === 'scalar' ? BOXED_JAVA_TYPES[node.base] : javaTypeForNode(node);
}

function javaTypeFor(leetcodeType) {
  const parsed = parseType(leetcodeType);
  return parsed ? javaTypeForNode(parsed) : null;
}

function scalarLiteral(base, value) {
  switch (base) {
    case 'integer':
    case 'long':
      return String(value);
    case 'double':
      return Number.isInteger(value) ? `${value}.0` : String(value);
    case 'boolean':
      return String(!!value);
    case 'string':
      return JSON.stringify(String(value));
    case 'character':
      return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    default:
      throw new Error(`Unsupported base type: ${base}`);
  }
}

// The {..} initializer body for an array node -- recurses through nested array
// dimensions, bottoming out at plain element literals (matches Java array-literal
// syntax, e.g. "new int[][]{{1,2},{3,4}}" has nested braces but only one "new" prefix).
function bracesFor(node, value) {
  const elementLiteral = (v) => (node.of.kind === 'array' ? bracesFor(node.of, v) : javaLiteralForNode(node.of, v));
  return `{${value.map(elementLiteral).join(',')}}`;
}

// Recursively emits nested `new TreeNode(val, left, right)` calls from the structure
// buildTreeStructure produced -- one Java expression, no runtime construction helper.
function javaTreeLiteral(node) {
  if (node === null) return 'null';
  return `new TreeNode(${node.val}, ${javaTreeLiteral(node.left)}, ${javaTreeLiteral(node.right)})`;
}

// A linked list needs no null-gap handling the way a tree does -- LeetCode's array
// notation for one is always flat, e.g. [1,2,3]. Built right-to-left, each node's
// `next` wired to the one built just before it, terminating in null.
function javaListNodeLiteral(vals) {
  if (!vals || vals.length === 0) return 'null';
  let expr = 'null';
  for (let i = vals.length - 1; i >= 0; i--) {
    expr = `new ListNode(${vals[i]}, ${expr})`;
  }
  return expr;
}

// Builds the Java source for constructing a value of the given type-tree node, e.g.:
//   scalar integer, 3          -> "3"
//   array of integer, [1,2,3]  -> "new int[]{1,2,3}"
//   list of integer, [1,2,3]   -> "new ArrayList<>(Arrays.asList(1, 2, 3))"
//   treenode, [3,9,20,...]     -> "new TreeNode(3, new TreeNode(9, null, null), ...)"
//   listnode, [1,2,3]          -> "new ListNode(1, new ListNode(2, new ListNode(3, null)))"
function javaLiteralForNode(node, value) {
  if (node.kind === 'scalar') return scalarLiteral(node.base, value);
  if (node.kind === 'treenode') return javaTreeLiteral(buildTreeStructure(value));
  if (node.kind === 'listnode') return javaListNodeLiteral(value);
  if (node.kind === 'array') return `new ${javaTypeForNode(node)}${bracesFor(node, value)}`;
  const elements = value.map((v) => javaLiteralForNode(node.of, v)).join(', ');
  return `new ArrayList<>(Arrays.asList(${elements}))`;
}

// Builds the Java source for constructing a value of the given LeetCode type,
// e.g. javaLiteral('integer[][]', [[1,2],[3,4]]) -> "new int[][]{{1,2},{3,4}}"
// or   javaLiteral('list<integer>', [1,2,3])      -> "new ArrayList<>(Arrays.asList(1, 2, 3))"
function javaLiteral(leetcodeType, value) {
  const parsed = parseType(leetcodeType);
  if (!parsed) throw new Error(`Unsupported type: ${leetcodeType}`);
  return javaLiteralForNode(parsed, value);
}

// LeetCode's own standard definitions -- verbatim match of what appears (as a comment
// only) above every tree/list problem's real starter code, since LeetCode's own judge
// compiles the user's Solution class against these definitions externally. This driver
// combines everything into one file, so they need to actually be compiled here, not
// left as a comment. Included unconditionally in every generated program (not just
// problems that use them) so JSON_HELPER's `instanceof TreeNode`/`instanceof ListNode`
// checks below always have something to reference -- conditionally omitting them only
// when unused would mean JSON_HELPER (shared across every problem) sometimes fails to
// compile depending on which problem it's bundled with. The cost of always including two
// small, unused classes on a non-tree/list problem is negligible.
const TREE_NODE_CLASS = `
class TreeNode {
  int val;
  TreeNode left;
  TreeNode right;
  TreeNode() {}
  TreeNode(int val) { this.val = val; }
  TreeNode(int val, TreeNode left, TreeNode right) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}
`;

const LIST_NODE_CLASS = `
class ListNode {
  int val;
  ListNode next;
  ListNode() {}
  ListNode(int val) { this.val = val; }
  ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
`;

const JSON_HELPER = `
  static String __judgeToJson(Object o) {
    if (o == null) return "null";
    if (o instanceof String) {
      return "\\"" + ((String) o).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"";
    }
    if (o instanceof Character) {
      return "\\"" + o.toString().replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"";
    }
    if (o instanceof TreeNode) {
      return __judgeToJson(__serializeTree((TreeNode) o));
    }
    if (o instanceof ListNode) {
      return __judgeToJson(__serializeList((ListNode) o));
    }
    if (o instanceof java.util.List) {
      java.util.List<?> list = (java.util.List<?>) o;
      StringBuilder lsb = new StringBuilder("[");
      for (int i = 0; i < list.size(); i++) {
        if (i > 0) lsb.append(",");
        lsb.append(__judgeToJson(list.get(i)));
      }
      lsb.append("]");
      return lsb.toString();
    }
    if (o.getClass().isArray()) {
      int len = java.lang.reflect.Array.getLength(o);
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < len; i++) {
        if (i > 0) sb.append(",");
        sb.append(__judgeToJson(java.lang.reflect.Array.get(o, i)));
      }
      sb.append("]");
      return sb.toString();
    }
    return String.valueOf(o);
  }

  // Serializes back to LeetCode's own level-order-with-nulls array notation -- the
  // reverse of buildTreeStructure/javaTreeLiteral above, but this half has to run at
  // Judge0 execution time (in Java), not codegen time, since the user's function
  // builds/returns a tree we don't know the shape of until it actually runs. BFS with a
  // LinkedList (not ArrayDeque -- that forbids null elements, and enqueuing null is how
  // a missing child's position gets correctly preserved for the next level): each real
  // node's value is recorded and both children enqueued (even if null, so their slot
  // still appears), each null dequeued is recorded but never expanded (a missing node
  // has no children to serialize). Trailing nulls are trimmed to match LeetCode's own
  // convention, verified by hand against a real example ([3,9,20,null,null,15,7] round-
  // trips exactly) before trusting it.
  static java.util.List<Integer> __serializeTree(TreeNode root) {
    java.util.List<Integer> result = new java.util.ArrayList<>();
    if (root == null) return result;
    java.util.LinkedList<TreeNode> queue = new java.util.LinkedList<>();
    queue.add(root);
    while (!queue.isEmpty()) {
      TreeNode node = queue.poll();
      if (node == null) {
        result.add(null);
        continue;
      }
      result.add(node.val);
      queue.add(node.left);
      queue.add(node.right);
    }
    while (!result.isEmpty() && result.get(result.size() - 1) == null) {
      result.remove(result.size() - 1);
    }
    return result;
  }

  // A linked list has no gaps to preserve, so this is just a walk -- no null-tracking
  // needed the way the tree serializer does.
  static java.util.List<Integer> __serializeList(ListNode head) {
    java.util.List<Integer> result = new java.util.ArrayList<>();
    while (head != null) {
      result.add(head.val);
      head = head.next;
    }
    return result;
  }
`;

// Combines every test case into ONE Java program / ONE Judge0 submission (avoids
// recompiling the same class per test case). Each test case is wrapped in its own
// try/catch + brace scope so a runtime exception on one case doesn't stop the rest from
// running or being reported -- it prints a __JUDGE_ERROR__-prefixed line instead.
export function generateJavaProgram({ userCode, functionSignature, testCases }) {
  const { name: methodName, params } = functionSignature;

  // Tree/list returns need their concrete type preserved through to the print step,
  // not erased to Object -- an empty tree/list is legitimately represented as `null` at
  // the Java level (unlike every other supported return type, where null is never the
  // correct "empty" value), and by the time a null Object reaches __judgeToJson there's
  // no way left to tell "this null means an empty tree" from any other kind of null.
  // Routing through the type-specific serializer first (which already handles a null
  // root/head correctly, returning an empty list) sidesteps the ambiguity entirely.
  const returnNode = parseType(functionSignature.return.type);

  const testCaseBlocks = testCases.map((tc, i) => {
    const declarations = params.map((p) => {
      const javaType = javaTypeFor(p.type);
      const literal = javaLiteral(p.type, tc.input[p.name]);
      return `      ${javaType} ${p.name}${i} = ${literal};`;
    }).join('\n');

    const args = params.map((p) => `${p.name}${i}`).join(', ');

    let resultDecl, printCall;
    if (returnNode?.kind === 'treenode') {
      resultDecl = `TreeNode __result${i} = sol.${methodName}(${args});`;
      printCall = `System.out.println(__judgeToJson(__serializeTree(__result${i})));`;
    } else if (returnNode?.kind === 'listnode') {
      resultDecl = `ListNode __result${i} = sol.${methodName}(${args});`;
      printCall = `System.out.println(__judgeToJson(__serializeList(__result${i})));`;
    } else {
      resultDecl = `Object __result${i} = sol.${methodName}(${args});`;
      printCall = `System.out.println(__judgeToJson(__result${i}));`;
    }

    return `
    try {
${declarations}
      ${resultDecl}
      ${printCall}
    } catch (Exception e) {
      System.out.println("__JUDGE_ERROR__:" + e.toString().replace("\\n", " "));
    }`;
  }).join('\n');

  return `import java.util.*;
import java.util.stream.*;
${TREE_NODE_CLASS}${LIST_NODE_CLASS}
${userCode}

class Main {
  public static void main(String[] args) {
    Solution sol = new Solution();
${testCaseBlocks}
  }
${JSON_HELPER}}
`;
}

