import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

const allowedCalls = new Set(['validateOptions', 'validateConfig', 'init']);
const functionTypes = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Keep engine-body calls to validation, initialization, and variable initializers.',
        includeInReadme: true,
        schema: [],
        messages: {
            call: 'Move this call into an engine function. The engine body permits only validateOptions(), validateConfig(), init(), and calls in variable initializers.',
        },
    },

    create(context) {
        function validateCall(node) {
            let child = node;
            let parent = node.parent;
            let initializer = false;
            while (parent && !functionTypes.has(parent.type)) {
                if (parent.type === 'VariableDeclarator' && parent.init === child) initializer = true;
                // Destructuring defaults are also part of variable initialization.
                if (parent.type === 'VariableDeclarator' && parent.id === child) initializer = true;
                child = parent;
                parent = parent.parent;
            }
            if (!parent || !isEngineFactory(parent) || child !== parent.body || initializer) return;
            const engine = parent;
            const callee = unwrap(node.callee);
            let expression = node;
            while (unwrap(expression.parent) === node) expression = expression.parent;
            const standalone = expression.parent.type === 'ExpressionStatement';

            if (node.type === 'CallExpression' && !node.optional && node.arguments.length === 0
                && standalone && callee?.type === 'Identifier' && allowedCalls.has(callee.name)) {
                let scope = context.sourceCode.getScope(callee);
                let variable;
                while (scope && !variable) {
                    variable = scope.set.get(callee.name);
                    scope = scope.upper;
                }
                if (variable?.defs.some(definition => definition.node.type === 'FunctionDeclaration'
                    && definition.node.parent === engine.body)) return;
            }
            context.report({node, messageId: 'call'});
        }

        return {
            CallExpression: validateCall,
            NewExpression: validateCall,
            ImportExpression: validateCall,
        };
    },
};
