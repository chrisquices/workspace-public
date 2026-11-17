const packages = ['vue', 'react', 'react-dom', 'svelte'];
const scopes = ['@vue/', '@inertiajs/'];

function getPath(node) {
    if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
    if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
    return null;
}

export default {
    meta: {
        type: 'problem',
        description: 'Keep UI engine code independent of framework imports.',
        includeInReadme: true,
        schema: [],
        messages: {
            framework: 'Keep UI Engines framework-independent; remove the framework import "{{path}}".',
        },
    },

    create(context) {
        function check(node) {
            const path = getPath(node);
            if (path === null) return;
            const normalized = path.toLowerCase();
            if (packages.some(name => normalized === name || normalized.startsWith(`${name}/`))
                || scopes.some(scope => normalized.startsWith(scope))) {
                context.report({node, messageId: 'framework', data: {path}});
            }
        }

        return {
            ImportDeclaration(node) { check(node.source); },
            ExportNamedDeclaration(node) { check(node.source); },
            ExportAllDeclaration(node) { check(node.source); },
            ImportExpression(node) { check(node.source); },
            TSImportType(node) { check(node.source); },
            TSImportEqualsDeclaration(node) {
                if (node.moduleReference.type === 'TSExternalModuleReference') check(node.moduleReference.expression);
            },
            CallExpression(node) {
                if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') return;
                let scope = context.sourceCode.getScope(node.callee);
                while (scope) {
                    const binding = scope.set.get('require');
                    if (binding) {
                        if (binding.defs.length > 0) return;
                        break;
                    }
                    scope = scope.upper;
                }
                check(node.arguments[0]);
            },
        };
    },
};
