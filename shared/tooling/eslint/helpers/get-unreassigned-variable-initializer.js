import { unwrapExpression } from './unwrap-expression.js';
import { resolveVariableBinding } from './resolve-variable-binding.js';

export function getUnreassignedVariableInitializer(expression, sourceCode) {
    const node = unwrapExpression(expression);

    if (!node || !['Identifier', 'JSXIdentifier'].includes(node.type)) {
        return null;
    }

    const variable = resolveVariableBinding(node, sourceCode);
    const definition = variable?.defs?.find(function (entry) {
        return entry.type === 'Variable';
    });

    if (!definition?.node.init || definition.node.id.type !== 'Identifier' || variable.references.some(function (reference) {
        return reference.isWrite() && !reference.init;
    })) {
        return null;
    }

    return { variable: variable, expression: definition.node.init };
}
