import { getUnreassignedVariableInitializer } from '#eslint/helpers/get-unreassigned-variable-initializer.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export function resolveImportOrigin(expression, sourceCode, seen = new Set()) {
    const node = unwrapExpression(expression);

    if (node && ['Identifier', 'JSXIdentifier'].includes(node.type)) {
        const definition = resolveVariableBinding(node, sourceCode)?.defs?.find(function (entry) {
            return entry.type === 'ImportBinding';
        });

        if (!definition) {
            const constant = getUnreassignedVariableInitializer(node, sourceCode);

            if (constant && !seen.has(constant.variable)) {
                return resolveImportOrigin(constant.expression, sourceCode, new Set([...seen, constant.variable]));
            }

            return null;
        }

        if (definition.node.importKind === 'type' || definition.parent.importKind === 'type') {
            return null;
        }

        const specifier = definition.node;
        let name = 'default';

        if (specifier.type === 'ImportSpecifier') {
            name = specifier.imported.name ?? specifier.imported.value;
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
            name = '*';
        }

        return { source: definition.parent.source.value, name: name };
    }

    if (node && ['MemberExpression', 'JSXMemberExpression'].includes(node.type)) {
        const owner = resolveImportOrigin(node.object, sourceCode, seen);

        if (owner?.name === '*') {
            return { source: owner.source, name: getStaticPropertyName(node) };
        }
    }

    return null;
}
