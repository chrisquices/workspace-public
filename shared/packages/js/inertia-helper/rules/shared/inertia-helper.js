import { unwrapScriptExpression as unwrapExpression } from '../../../../../tooling/eslint/helpers/script-props.js';

export { unwrapExpression };

const packageName = 'workspace-packages/inertia-helper';

// Openable surfaces share naming and options requirements.
// AlertDialog is included by its Dialog suffix.
const surfaceSuffixes = ['Dialog', 'Sheet', 'Drawer'];

export function isSurfaceName(name) {
  return surfaceSuffixes.some((suffix) => name.endsWith(suffix));
}

function findVariable(sourceCode, node) {
  let scope = sourceCode.getScope(node);

  while (scope) {
    const variable = scope.set.get(node.name);

    if (variable) {
      return variable;
    }

    scope = scope.upper;
  }

  return undefined;
}

export function propertyName(node) {
  if (!node.computed && node.key.type === 'Identifier') {
    return node.key.name;
  }

  return node.key.type === 'Literal' ? String(node.key.value) : undefined;
}

export function factoryName(sourceCode, expression) {
  const node = unwrapExpression(expression);
  const identifier = node?.type === 'MemberExpression' ? unwrapExpression(node.object) : node;

  if (identifier?.type !== 'Identifier') return undefined;

  const variable = findVariable(sourceCode, identifier);
  const binding = variable?.defs.find((definition) => definition.type === 'ImportBinding');
  let name;

  if (!variable && node.type === 'Identifier') {
    name = node.name;
  } else if (binding?.parent?.source?.value === packageName) {
    if (node.type === 'Identifier' && binding.node.type === 'ImportSpecifier') {
      name = binding.node.imported.name ?? binding.node.imported.value;
    } else if (node.type === 'MemberExpression' && binding.node.type === 'ImportNamespaceSpecifier') {
      name = node.computed ? node.property.value : node.property.name;
    }
  }

  return name === 'useInertiaHelperForm' ? name : undefined;
}

export function consumingDeclarator(call) {
  let node = call;

  while (node.parent && unwrapExpression(node.parent) === call) {
    node = node.parent;
  }

  return node.parent?.type === 'VariableDeclarator' && node.parent.init === node
    ? node.parent
    : undefined;
}

export function formProperty(node, name) {
  const options = unwrapExpression(node.arguments[0]);
  if (node.arguments.length !== 1 || options?.type !== 'ObjectExpression') return undefined;

  for (const property of [...options.properties].reverse()) {
    if (property.type !== 'Property' || propertyName(property) === undefined) return undefined;
    if (propertyName(property) === name) {
      return property.kind === 'init' && !property.method ? property : undefined;
    }
  }
}

export function formConfig(node) {
  return unwrapExpression(formProperty(node, 'config')?.value);
}

export function formDefinition(sourceCode, node) {
  return factoryName(sourceCode, node.callee) === 'useInertiaHelperForm'
    ? unwrapExpression(formProperty(node, 'form')?.value)
    : undefined;
}

export function functionValue(sourceCode, expression, seen = new Set()) {
  const node = unwrapExpression(expression);
  if (!node || seen.has(node)) return undefined;
  seen.add(node);

  if (['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration'].includes(node.type)) {
    return node;
  }

  if (node.type === 'Identifier') {
    const definition = findVariable(sourceCode, node)?.defs[0];
    if (definition?.type === 'FunctionName') return definition.node;
    if (definition?.type === 'Variable') return functionValue(sourceCode, definition.node.init, seen);
  }

  return undefined;
}
