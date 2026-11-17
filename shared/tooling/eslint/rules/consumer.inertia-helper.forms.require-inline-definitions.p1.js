// Keep form fields and methods explicitly visible; unknown members are manual.
import { createInertiaCallAnalyzer } from '#eslint/helpers/create-inertia-call-analyzer.js';
import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'problem',
        description: 'Define Inertia Helper forms inline with explicit members rather than spreads or unknown computed keys.',
        includeInReadme: true,
        schema: [],
        messages: {
            definition: 'Define useInertiaHelperForm fields and methods inside an explicit inline form object. Preserve values, initialization order, method behavior, and references when moving the definition.',
            unknown: 'Declare this form member explicitly instead of using a spread or unknown computed name. Preserve its data and behavior; keep the form methods handleSubmit() and submit() visible. Choosing members requires manual correction.',
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
                const definitions = node.arguments.length === 1 && argument?.type === 'ObjectExpression'
                    ? bindings.objectProperty(argument, 'form') : [];
                if (definitions.length !== 1 || unwrapExpression(definitions[0].expression)?.type !== 'ObjectExpression') {
                    context.report({ node: node, messageId: 'definition' });
                    return;
                }

                const definition = unwrapExpression(definitions[0].expression);
                if (reported.has(definition)) return;
                reported.add(definition);

                for (const property of definition.properties) {
                    if (property.type === 'SpreadElement' || getStaticPropertyName(property) === null) {
                        context.report({ node: property, messageId: 'unknown' });
                    }
                }
            },
        };
    },
};
