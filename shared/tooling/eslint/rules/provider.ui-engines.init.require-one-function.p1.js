import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Declare exactly one init function directly inside each UI engine.',
        includeInReadme: true,
        schema: [],
        messages: {
            required: 'Declare exactly one init() function directly inside this engine to contain its startup sequence. Found {{count}}.',
        },
    },

    create(context) {
        function validateEngine(node) {
            if (!isEngineFactory(node)) return;

            const declarations = node.body.body.filter(statement => statement.type === 'FunctionDeclaration'
                && statement.id?.name === 'init' && statement.body?.type === 'BlockStatement');
            if (declarations.length !== 1) {
                context.report({node: node.id ?? node, messageId: 'required', data: {count: declarations.length}});
            }
        }

        return {
            FunctionDeclaration: validateEngine,
            FunctionExpression: validateEngine,
            ArrowFunctionExpression: validateEngine,
        };
    },
};
