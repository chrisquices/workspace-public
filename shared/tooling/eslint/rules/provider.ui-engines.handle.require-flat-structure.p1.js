import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Return a flat UI engine handle containing direct identifier references.',
        includeInReadme: true,
        schema: [],
        messages: {
            handle: 'Return the public handle as a flat object literal containing direct references, such as return {play: play, pause: pause, destroy: destroy};.',
            property: 'Expose an existing function directly in the public handle, such as getState: getState. Do not use computed properties, methods, wrappers, nested objects, getters, or spreads.',
        },
    },

    create(context) {
        function validateEngine(node) {
            if (!isEngineFactory(node)) return;

            const finalReturn = node.body.body.at(-1);
            if (finalReturn?.type !== 'ReturnStatement' || finalReturn.argument?.type !== 'ObjectExpression') {
                context.report({node: finalReturn ?? node, messageId: 'handle'});
                return;
            }

            for (const property of finalReturn.argument.properties) {
                if (property.type !== 'Property' || property.computed
                    || property.method || property.kind !== 'init' || property.value.type !== 'Identifier') {
                    context.report({node: property, messageId: 'property'});
                }
            }
        }

        return {
            FunctionDeclaration: validateEngine,
            FunctionExpression: validateEngine,
            ArrowFunctionExpression: validateEngine,
        };
    },
};
