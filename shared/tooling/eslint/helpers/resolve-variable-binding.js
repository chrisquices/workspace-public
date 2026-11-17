import { getModuleScope } from './get-module-scope.js';

export function resolveVariableBinding(node, sourceCode) {
    const container = sourceCode.getAncestors(node).findLast(function (ancestor) {
        return ancestor.type === 'VExpressionContainer';
    });
    let scope = sourceCode.getScope(node);

    if (container) {
        const reference = container.references.find(function (entry) {
            return entry.id === node;
        });

        if (!reference || reference.variable) {
            return reference?.variable ?? null;
        }

        scope = getModuleScope(sourceCode);
    }

    while (scope && !scope.set.has(node.name)) {
        scope = scope.upper;
    }

    return scope?.set.get(node.name) ?? null;
}
