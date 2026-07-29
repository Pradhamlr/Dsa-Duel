// C++ counterpart to javaDriverGenerator.js -- same job (turn a submitted Solution class
// + parsed test cases into one runnable program), same overall shape, different target
// syntax. Reuses the shared, language-agnostic type-tree (./typeTree.js) and output
// parser (./judgeOutputParser.js) rather than re-deriving either.
//
// Two real differences from the Java driver, not just syntax:
//  - LeetCode's C++ signatures use vector<T> uniformly for both "array" and "list"
//    type-tree kinds (no array-vs-List split, so no boxed-type wrinkle either).
//  - No runtime reflection in C++, so the generic print helper can't work the way
//    Java's __judgeToJson does. It doesn't need to, though: the return type is already
//    known from functionSignature.return.type at codegen time, so a small set of
//    overloaded judgeToJson functions (resolved at compile time) does the same job --
//    scalar overloads bottom out the recursion, one templated vector<T> overload
//    handles arbitrary nesting depth.
//
// Known, accepted gap (documented, not engineered around): a C++ solution that reads
// out of bounds or dereferences null is undefined behavior, not a catchable exception
// the way Java's ArrayIndexOutOfBoundsException/NullPointerException are. A crash there
// can take down the whole submission (Judge0 reports it as a distinct runtime-error
// status), losing every remaining test case in that run, not just the offending one --
// unlike Java, where each test case's try/catch isolates it from the others.

import { parseType, isTypeSupported, checkSignatureSupported } from './typeTree.js';
import { parseJudgeOutput } from './judgeOutputParser.js';

export { isTypeSupported, checkSignatureSupported };

const PRIMITIVE_CPP_TYPES = {
  integer: 'int',
  long: 'long long',
  double: 'double',
  boolean: 'bool',
  string: 'string',
  character: 'char'
};

function cppTypeForNode(node) {
  if (node.kind === 'scalar') return PRIMITIVE_CPP_TYPES[node.base];
  // Both 'array' and 'list' kinds map to vector<T> -- LeetCode's real C++ signatures
  // (see codeSnippets.cpp on any array/list problem) use vector uniformly, so there's
  // one target shape per nesting level, not two.
  return `vector<${cppTypeForNode(node.of)}>`;
}

function cppTypeFor(leetcodeType) {
  const parsed = parseType(leetcodeType);
  return parsed ? cppTypeForNode(parsed) : null;
}

function cppScalarLiteral(base, value) {
  switch (base) {
    case 'integer':
      return String(value);
    case 'long':
      // Explicit LL suffix rather than relying on the compiler's literal-type
      // deduction -- correct either way for a value this size, but not left implicit.
      return `${value}LL`;
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

// Builds the brace-init body for a value of the given type-tree node. Unlike Java
// (which needs a repeated "new int[]{...}" / "new ArrayList<>(Arrays.asList(...))" per
// nesting kind), C++11 brace-init nests uniformly for vector<vector<T>> and deeper, so
// one recursive function covers every depth without a separate array-vs-list branch --
// this only works because the caller always uses it directly against a declared,
// already-typed variable (`vector<int> nums0 = {...};`), never as a standalone
// type-carrying expression the way Java's literal needed to be.
function cppLiteralForNode(node, value) {
  if (node.kind === 'scalar') return cppScalarLiteral(node.base, value);
  const elements = value.map((v) => cppLiteralForNode(node.of, v)).join(', ');
  return `{${elements}}`;
}

function cppLiteral(leetcodeType, value) {
  const parsed = parseType(leetcodeType);
  if (!parsed) throw new Error(`Unsupported type: ${leetcodeType}`);
  return cppLiteralForNode(parsed, value);
}

// Overload set, not a single reflective function -- the compiler picks the right one at
// compile time based on the known return type, and the templated vector<T> overload
// recurses for arbitrary nesting depth (vector<vector<int>>, etc.) the same way Java's
// reflection-based walk did, just resolved statically instead of at runtime.
const JSON_HELPERS = `
string judgeToJson(int v) { return to_string(v); }
string judgeToJson(long long v) { return to_string(v); }
string judgeToJson(bool v) { return v ? "true" : "false"; }
string judgeToJson(double v) {
  ostringstream oss;
  oss << setprecision(17) << v;
  return oss.str();
}
string judgeToJson(char v) {
  string s = "\\"";
  if (v == '\\\\' || v == '"') s += '\\\\';
  s += v;
  s += "\\"";
  return s;
}
string judgeToJson(const string& v) {
  string s = "\\"";
  for (char c : v) {
    if (c == '\\\\' || c == '"') s += '\\\\';
    s += c;
  }
  s += "\\"";
  return s;
}
template <typename T>
string judgeToJson(const vector<T>& v) {
  string s = "[";
  for (size_t i = 0; i < v.size(); i++) {
    if (i > 0) s += ",";
    s += judgeToJson(v[i]);
  }
  s += "]";
  return s;
}
`;

// Combines every test case into ONE C++ program / ONE Judge0 submission, same
// one-compile-many-test-cases optimization the Java driver made. Each test case is
// wrapped in its own try/catch so a thrown std::exception on one case doesn't stop the
// rest from running -- but see the module comment above: this can't catch undefined
// behavior (out-of-bounds access, null deref), which is a real, accepted gap C++
// introduces that Java's driver didn't have.
export function generateCppProgram({ userCode, functionSignature, testCases }) {
  const { name: methodName, params } = functionSignature;

  const testCaseBlocks = testCases.map((tc, i) => {
    const declarations = params.map((p) => {
      const cppType = cppTypeFor(p.type);
      const literal = cppLiteral(p.type, tc.input[p.name]);
      return `      ${cppType} ${p.name}${i} = ${literal};`;
    }).join('\n');

    const args = params.map((p) => `${p.name}${i}`).join(', ');

    return `
  try {
${declarations}
    auto __result${i} = sol.${methodName}(${args});
    cout << judgeToJson(__result${i}) << endl;
  } catch (const std::exception& e) {
    cout << "__JUDGE_ERROR__:" << e.what() << endl;
  } catch (...) {
    cout << "__JUDGE_ERROR__:unknown error" << endl;
  }`;
  }).join('\n');

  return `#include <bits/stdc++.h>
using namespace std;

${userCode}
${JSON_HELPERS}
int main() {
  Solution sol;
${testCaseBlocks}
  return 0;
}
`;
}

export const parseCppOutput = parseJudgeOutput;
