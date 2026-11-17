// Flag named or variable-assigned functions that only return a plain function
// call with simple parameters forwarded unchanged, once each, in declaration order.
// Allow method calls, chains, callbacks, fixed or transformed inputs, parameter
// adaptations, async/generator behavior, optional calls, and type specializations.
// Review public API boundaries and callback contracts before removing a match.
// Reports guide manual changes because a useful name or API boundary needs judgment.

import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Flag functions that only return a plain function call with their simple parameters forwarded unchanged and in order. Require manual review of API and callback contracts before removal.',
        includeInReadme: true,
        schema: [],
        messages: {
            wrapper: 'This function only returns {{callee}} with its parameters forwarded unchanged and in order. Review whether its name, exported API, or callback contract justifies the boundary. When redundant, update its uses to call {{callee}} directly and remove it manually, preserving binding, evaluation order, and return behavior.',
        },
    },

    create(context) {
        function check(node) {
            let declaration = node;

            while (declaration.parent && unwrapExpression(declaration.parent) === node) {
                declaration = declaration.parent;
            }

            if (node.type !== 'FunctionDeclaration' && declaration.parent?.type !== 'VariableDeclarator') {
                return;
            }

            if (node.async || node.generator || node.params.some(function (parameter) {
                return parameter.type !== 'Identifier' || parameter.optional;
            })) {
                return;
            }

            const parameterNames = node.params.map(function (parameter) { return parameter.name; });

            if (new Set(parameterNames).size !== parameterNames.length) {
                return;
            }

            let expression = node.body;

            if (expression?.type === 'BlockStatement') {
                if (expression.body.length !== 1 || expression.body[0].type !== 'ReturnStatement') {
                    return;
                }

                expression = expression.body[0].argument;
            }

            if (expression?.type !== 'CallExpression' || expression.callee.type !== 'Identifier'
                || expression.optional || expression.typeArguments || expression.typeParameters
                || expression.callee.name === 'eval' || expression.arguments.length !== node.params.length) {
                return;
            }

            if (!expression.arguments.every(function (argument, index) {
                return argument.type === 'Identifier' && argument.name === parameterNames[index];
            })) {
                return;
            }

            const callee = resolveVariableBinding(expression.callee, context.sourceCode);

            if (callee?.scope.block === node || callee?.defs.some(function (definition) {
                return definition.node === node || definition.node === declaration.parent;
            })) {
                return;
            }

            context.report({ node: node, messageId: 'wrapper', data: { callee: expression.callee.name } });
        }

        return {
            FunctionDeclaration: check,
            FunctionExpression: check,
            ArrowFunctionExpression: check,
        };
    },
};
