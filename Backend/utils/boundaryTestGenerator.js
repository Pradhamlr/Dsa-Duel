import { parseType } from './typeTree.js';

// Auto-generates edge-case inputs from a problem's own type tree -- no reference
// solution exists for these, so there's no "expected output" to check against, only
// whether the submitted code crashes or times out on them. A crash/timeout confidence
// check, not an additional correctness verification.
//
// One scenario applies to every param simultaneously (rather than a per-param
// cross-product), so the case count stays fixed at four regardless of how many params
// a signature has -- matching the four categories asked for: empty, single-element,
// negative, and large inputs.
const SCENARIOS = [
  { key: 'empty', label: 'Empty / zero inputs' },
  { key: 'single', label: 'Single element' },
  { key: 'negative', label: 'Negative values' },
  { key: 'large', label: 'Large input' }
];

const LARGE_COLLECTION_SIZE = 1000;

function scalarBoundaryValue(base, scenario) {
  switch (base) {
    case 'integer':
      return { empty: 0, single: 1, negative: -7, large: 1000000000 }[scenario];
    case 'long':
      return { empty: 0, single: 1, negative: -7, large: 1000000000000 }[scenario];
    case 'double':
      return { empty: 0.0, single: 1.5, negative: -3.5, large: 1000000000.5 }[scenario];
    case 'boolean':
      return scenario === 'negative' ? false : true;
    case 'string':
      return { empty: '', single: 'a', negative: 'sample', large: 'x'.repeat(LARGE_COLLECTION_SIZE) }[scenario];
    case 'character':
      // No meaningful "empty" or "negative" char -- always a plain filler value so the
      // rest of a multi-param case still exercises the scenario on its other params.
      return 'a';
    default:
      return null;
  }
}

// Tree/list boundary values use LeetCode's own flat level-order-with-nulls array
// convention -- the same shape every real problem's testCases already store, which the
// driver's own codegen (buildTreeStructure et al.) already knows how to consume, so no
// new construction logic is needed on the driver side for these.
function nodeBoundaryValue(scenario) {
  switch (scenario) {
    case 'empty': return [];
    case 'single': return [1];
    case 'negative': return [-1, -2, -3];
    case 'large': return Array.from({ length: LARGE_COLLECTION_SIZE }, (_, i) => i);
    default: return [];
  }
}

function collectionBoundaryValue(node, scenario) {
  switch (scenario) {
    case 'empty':
      return [];
    case 'single':
      return [boundaryValueForNode(node.of, 'single')];
    case 'negative':
      return [boundaryValueForNode(node.of, 'negative'), boundaryValueForNode(node.of, 'negative'), boundaryValueForNode(node.of, 'negative')];
    case 'large':
      return Array.from({ length: LARGE_COLLECTION_SIZE }, () => boundaryValueForNode(node.of, 'single'));
    default:
      return [];
  }
}

function boundaryValueForNode(node, scenario) {
  switch (node.kind) {
    case 'scalar':
      return scalarBoundaryValue(node.base, scenario);
    case 'array':
    case 'list':
      return collectionBoundaryValue(node, scenario);
    case 'treenode':
    case 'listnode':
      return nodeBoundaryValue(scenario);
    default:
      return null;
  }
}

// Returns [] if any param's type can't be parsed -- shouldn't happen in practice since
// checkSignatureSupported already gates this upstream of every call site, but this
// stays defensive rather than generating garbage input for an unrecognized type.
export function generateBoundaryTestCases(functionSignature) {
  const params = functionSignature?.params || [];
  const paramNodes = params.map((p) => ({ name: p.name, node: parseType(p.type) }));
  if (paramNodes.length === 0 || paramNodes.some((p) => !p.node)) return [];

  return SCENARIOS.map(({ key, label }) => {
    const input = {};
    for (const { name, node } of paramNodes) {
      input[name] = boundaryValueForNode(node, key);
    }
    return { label, input };
  });
}
