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

// "integer[][]" -> { base: 'integer', dims: 2 }
function parseType(leetcodeType) {
  if (typeof leetcodeType !== 'string') return null;
  const match = leetcodeType.trim().match(/^([a-zA-Z]+)((?:\[\])*)$/);
  if (!match) return null;
  const base = match[1].toLowerCase();
  if (!PRIMITIVE_JAVA_TYPES[base]) return null;
  return { base, dims: match[2].length / 2 };
}

export function isTypeSupported(leetcodeType) {
  return parseType(leetcodeType) !== null;
}

function javaTypeFor(leetcodeType) {
  const parsed = parseType(leetcodeType);
  if (!parsed) return null;
  return PRIMITIVE_JAVA_TYPES[parsed.base] + '[]'.repeat(parsed.dims);
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

function arrayInitializer(base, dims, value) {
  if (dims === 0) return scalarLiteral(base, value);
  const inner = value.map((v) => arrayInitializer(base, dims - 1, v)).join(',');
  return `{${inner}}`;
}

// Builds the Java source for constructing a value of the given LeetCode type,
// e.g. javaLiteral('integer[][]', [[1,2],[3,4]]) -> "new int[][]{{1,2},{3,4}}"
function javaLiteral(leetcodeType, value) {
  const parsed = parseType(leetcodeType);
  if (!parsed) throw new Error(`Unsupported type: ${leetcodeType}`);
  if (parsed.dims === 0) return scalarLiteral(parsed.base, value);
  const javaBase = PRIMITIVE_JAVA_TYPES[parsed.base];
  return `new ${javaBase}${'[]'.repeat(parsed.dims)}${arrayInitializer(parsed.base, parsed.dims, value)}`;
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
