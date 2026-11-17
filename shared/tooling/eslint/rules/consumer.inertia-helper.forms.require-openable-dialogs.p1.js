// Dialog and AlertDialog helper bindings must explicitly enable openable.
// Sheet and Drawer are not part of the approved helper naming convention.
import { createInertiaCallAnalyzer } from '#eslint/helpers/create-inertia-call-analyzer.js';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'problem',
        description: 'Set openable to true for Inertia Helper forms named with Dialog or AlertDialog suffixes.',
        includeInReadme: true,
        schema: [],
        messages: {
            openable: 'Inertia Helper form "{{name}}" ends in Dialog or AlertDialog and must declare config.openable: true with no later unknown override. Preserve the intended surface behavior and correct the configuration manually; do not rename the form merely to evade this requirement.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const bindings = createInertiaCallAnalyzer(sourceCode);

        return {
            VariableDeclarator(node) {
                const call = unwrapExpression(node.init);
                if (node.id.type !== 'Identifier' || !node.id.name.endsWith('Dialog') || call?.type !== 'CallExpression') return;
                const factory = resolveImportOrigin(call.callee, sourceCode);
                if (factory?.source !== 'workspace-packages/inertia-helper' || factory.name !== 'useInertiaHelperForm') return;

                const configs = call.arguments.length === 1 && call.arguments[0].type !== 'SpreadElement'
                    ? bindings.objectProperty(call.arguments[0], 'config') : [];
                const enabled = configs.length > 0 && configs.every(function (config) {
                    if (!config.expression) return false;
                    return bindings.objectProperty(config.expression, 'openable', config.seen).every(function (value) {
                        const expression = unwrapExpression(value.expression);
                        return expression?.type === 'Literal' && expression.value === true;
                    });
                });
                if (!enabled) context.report({ node: node.id, messageId: 'openable', data: { name: node.id.name } });
            },
        };
    },
};
