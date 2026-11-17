// Replace relative module specifiers with aliases or package imports across all
// source audiences. For Node-based ESLint tooling, use the imports map in
// shared/package.json. Node import maps are scoped to the nearest package.json.

function getPath(node) {
    if (node?.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }

    if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis[0].value.cooked;
    }

    return null;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Require configured aliases or package imports for statically known module paths in imports, re-exports, dynamic imports, require calls, and TypeScript import forms.',
        includeInReadme: true,
        schema: [],
        messages: {
            relative: 'Replace relative module path "{{path}}" with a configured alias or public package import that resolves to the same module. Check the project aliases and package exports, then update the path manually while preserving the imported symbols and import form.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        function check(node) {
            const path = getPath(node);

            if (path !== null && /^\.{1,2}(?:[\\/]|$)/u.test(path)) {
                context.report({ node: node, messageId: 'relative', data: { path: path } });
            }
        }

        function checkRequire(node) {
            if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') {
                return;
            }

            let scope = sourceCode.getScope(node.callee);
            const expression = sourceCode.getAncestors(node).findLast((function (ancestor) { return (ancestor.type === 'VExpressionContainer'); }));

            if (expression) {
                const reference = expression.references.find((function (reference) { return (reference.id === node.callee); }));

                if (!reference || reference.variable) {
                    return;
                }

                scope = sourceCode.scopeManager.acquire(sourceCode.ast, true) ?? scope;
            }

            while (scope) {
                const variable = scope.set.get('require');

                if (variable) {
                    if (variable.defs.length > 0) {
                        return;
                    }

                    break;
                }

                scope = scope.upper;
            }

            check(node.arguments[0]);
        }

        const visitor = {
            ImportDeclaration(node) {
                check(node.source);
            },

            ExportNamedDeclaration(node) {
                check(node.source);
            },

            ExportAllDeclaration(node) {
                check(node.source);
            },

            ImportExpression(node) {
                check(node.source);
            },

            TSImportType(node) {
                check(node.source);
            },

            TSImportEqualsDeclaration(node) {
                if (node.moduleReference.type === 'TSExternalModuleReference') {
                    check(node.moduleReference.expression);
                }
            },
            CallExpression: checkRequire,
        };

        return sourceCode.parserServices.defineTemplateBodyVisitor?.(visitor, visitor) ?? visitor;
    },
};
