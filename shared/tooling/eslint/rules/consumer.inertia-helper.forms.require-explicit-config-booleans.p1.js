// Require explicit booleans without choosing defaults or guessing spread values.
import { createInertiaCallAnalyzer } from '#eslint/helpers/create-inertia-call-analyzer.js';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'problem',
        description: 'Set openable and minimumLoading explicitly to true or false in Inertia Helper config.',
        includeInReadme: true,
        schema: [],
        messages: {
            config: 'Declare an explicit inline config object in useInertiaHelperForm with openable and minimumLoading each set to true or false. Preserve existing behavior; choose these values deliberately rather than guessing defaults.',
            missing: 'Set {{option}} explicitly to true or false in this Inertia Helper config. Preserve the intended behavior; do not infer a default.',
            boolean: 'Set {{option}} to an explicit true or false literal in this Inertia Helper config and ensure no later spread or unknown computed key can override it. Preserve the intended behavior.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const bindings = createInertiaCallAnalyzer(sourceCode);
        const reported = new WeakSet();

        return {
            CallExpression(node) {
                const factory = resolveImportOrigin(node.callee, sourceCode);
                if (factory?.source !== 'workspace-packages/inertia-helper' || factory.name !== 'useInertiaHelperForm') return;

                const argument = unwrapExpression(node.arguments[0]);
                const configs = node.arguments.length === 1 && argument?.type === 'ObjectExpression'
                    ? bindings.objectProperty(argument, 'config') : [];
                if (configs.length !== 1 || unwrapExpression(configs[0].expression)?.type !== 'ObjectExpression') {
                    context.report({ node: node, messageId: 'config' });
                    return;
                }

                const config = unwrapExpression(configs[0].expression);
                if (reported.has(config)) return;
                reported.add(config);

                for (const option of ['openable', 'minimumLoading']) {
                    let property;
                    let overridden = false;
                    for (const entry of config.properties.toReversed()) {
                        if (entry.type === 'SpreadElement' || getStaticPropertyName(entry) === null) {
                            overridden = true;
                            continue;
                        }
                        if (getStaticPropertyName(entry) === option) {
                            property = entry;
                            break;
                        }
                    }
                    if (!property) {
                        context.report({ node: config, messageId: 'missing', data: { option: option } });
                        continue;
                    }
                    const value = unwrapExpression(property.value);
                    if (overridden || property.kind !== 'init' || property.method
                        || value?.type !== 'Literal' || typeof value.value !== 'boolean') {
                        context.report({ node: property, messageId: 'boolean', data: { option: option } });
                    }
                }
            },
        };
    },
};
