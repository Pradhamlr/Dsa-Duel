// Turns a user's submitted Solution class + a problem's parsed test cases into one
// runnable Java program: declare each test case's inputs with the exact types LeetCode's
// metaData describes, call the user's method, print the result, repeat per test case.
//
// Output printing deliberately does NOT special-case per return type. A single generic
// helper (__judgeToJson, via reflection) prints ints/booleans/Strings/arbitrarily-nested
// arrays alike -- much simpler and more robust than generating bespoke print code per
// type/dimension combination. Only the INPUT side needs type-specific code, since Java
// requires explicit typed variable declarations for method arguments.

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

// Recursive-descent parser for LeetCode's type strings into a small type-tree, e.g.:
//   "integer"            -> { kind: 'scalar', base: 'integer' }
//   "integer[][]"        -> { kind: 'array', of: { kind: 'array', of: {scalar integer} } }
//   "list<list<integer>>"-> { kind: 'list', of: { kind: 'list', of: {scalar integer} } }
// Anything else (TreeNode, ListNode, custom classes, ...) fails to parse and returns
// null, same as before -- those remain correctly unsupported, not silently mishandled.
function parseType(leetcodeType) {
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
    if (!PRIMITIVE_JAVA_TYPES[base]) return null;
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

function javaTypeForNode(node) {
  if (node.kind === 'scalar') return PRIMITIVE_JAVA_TYPES[node.base];
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

// Builds the Java source for constructing a value of the given type-tree node, e.g.:
//   scalar integer, 3          -> "3"
//   array of integer, [1,2,3]  -> "new int[]{1,2,3}"
//   list of integer, [1,2,3]   -> "new ArrayList<>(Arrays.asList(1, 2, 3))"
function javaLiteralForNode(node, value) {
  if (node.kind === 'scalar') return scalarLiteral(node.base, value);
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

const JSON_HELPER = `
  static String __judgeToJson(Object o) {
    if (o == null) return "null";
    if (o instanceof String) {
      return "\\"" + ((String) o).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"";
    }
    if (o instanceof Character) {
      return "\\"" + o.toString().replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"";
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
`;

// Checks every param + the return type against the supported type set. Problems whose
// signature includes something we don't handle (TreeNode, ListNode, List<T>, custom
// classes) should be rejected clearly up front, not attempted and left to fail with a
// confusing compile error deep inside Judge0.
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

// Combines every test case into ONE Java program / ONE Judge0 submission (avoids
// recompiling the same class per test case). Each test case is wrapped in its own
// try/catch + brace scope so a runtime exception on one case doesn't stop the rest from
// running or being reported -- it prints a __JUDGE_ERROR__-prefixed line instead.
export function generateJavaProgram({ userCode, functionSignature, testCases }) {
  const { name: methodName, params } = functionSignature;

  const testCaseBlocks = testCases.map((tc, i) => {
    const declarations = params.map((p) => {
      const javaType = javaTypeFor(p.type);
      const literal = javaLiteral(p.type, tc.input[p.name]);
      return `      ${javaType} ${p.name}${i} = ${literal};`;
    }).join('\n');

    const args = params.map((p) => `${p.name}${i}`).join(', ');

    return `
    try {
${declarations}
      Object __result${i} = sol.${methodName}(${args});
      System.out.println(__judgeToJson(__result${i}));
    } catch (Exception e) {
      System.out.println("__JUDGE_ERROR__:" + e.toString().replace("\\n", " "));
    }`;
  }).join('\n');

  return `import java.util.*;
import java.util.stream.*;

${userCode}

class Main {
  public static void main(String[] args) {
    Solution sol = new Solution();
${testCaseBlocks}
  }
${JSON_HELPER}}
`;
}

// Parses the stdout from a generateJavaProgram run back into per-test-case results.
export function parseJavaOutput(stdout, testCases) {
  const lines = (stdout || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  return testCases.map((tc, i) => {
    const line = lines[i];
    if (line === undefined) {
      return { input: tc.input, expectedOutput: tc.output, actualOutput: null, passed: false, error: 'No output produced for this test case' };
    }
    if (line.startsWith('__JUDGE_ERROR__:')) {
      return { input: tc.input, expectedOutput: tc.output, actualOutput: null, passed: false, error: line.slice('__JUDGE_ERROR__:'.length) };
    }
    let actual;
    try {
      actual = JSON.parse(line);
    } catch {
      return { input: tc.input, expectedOutput: tc.output, actualOutput: line, passed: false, error: 'Could not parse output' };
    }
    const passed = JSON.stringify(actual) === JSON.stringify(tc.output);
    return { input: tc.input, expectedOutput: tc.output, actualOutput: actual, passed };
  });
}
