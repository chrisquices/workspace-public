// Require one method reference or one direct method call in each Vue click handler.
// Allow valueless handlers with .stop or .prevent for modifier-only behavior.
// Allow ternaries inside arguments, including nested payload values. Keep method
// selection direct. Move logical short-circuiting, mutations, inline functions,
// and additional calls into the method, including logic nested in arguments or
// computed properties. Correct manually to preserve event arguments, scope,
// receiver binding, and evaluation order.

import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

const inlineLogic = new Set([
    'AssignmentExpression',
    'UpdateExpression',
    'SequenceExpression',
    'LogicalExpression',
    'ArrowFunctionExpression',
    'FunctionExpression',
    'ClassExpression',
    'NewExpression',
    'TaggedTemplateExpression',
    'AwaitExpression',
    'YieldExpression',
]);

function isMethodReference(expression) {
    const node = unwrapExpression(expression);

    if (node?.type === 'Identifier') {
        return true;
    }

    return node?.type === 'MemberExpression'
        && (unwrapExpression(node.object)?.type === 'ThisExpression' || isMethodReference(node.object));
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Use one method reference or direct method call per click handler; move inline logic into the method.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            singleMethod: 'Use one method reference, such as @click="trigger", or one direct method call, such as @click="dropzone.trigger()" or @click="dialog.show({ id: item.id })". Ternaries may compute argument values. Move conditional method selection, logical short-circuiting, mutations, inline functions, and additional calls into the method, including logic nested in arguments or computed properties. Preserve event arguments, scope, receiver binding, and evaluation order when correcting manually.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const services = sourceCode.parserServices;

        if (!services.defineTemplateBodyVisitor) {
            return {};
        }

        function hasInlineLogic(expression, allowedCall, insideArgument = false) {
            const node = unwrapExpression(expression);

            if (!node || node.type.startsWith('TS')) {
                return false;
            }

            if (inlineLogic.has(node.type)
                || (node.type === 'ConditionalExpression' && !insideArgument)
                || (node.type === 'CallExpression' && node !== allowedCall)
                || (node.type === 'UnaryExpression' && node.operator === 'delete')) {
                return true;
            }

            return (sourceCode.visitorKeys[node.type] ?? []).some(function (key) {
                const value = node[key];

                return (Array.isArray(value) ? value : [value]).some(function (child) {
                    return child?.type && hasInlineLogic(child, allowedCall, insideArgument || (node === allowedCall && key === 'arguments'));
                });
            });
        }

        return services.defineTemplateBodyVisitor({
            VAttribute(node) {
                if (!node.directive || node.key.name.name !== 'on'
                    || node.key.argument?.type !== 'VIdentifier' || node.key.argument.name !== 'click') {
                    return;
                }

                if (!node.value && node.key.modifiers.some(function (modifier) {
                    return modifier.name === 'stop' || modifier.name === 'prevent';
                })) {
                    return;
                }

                let expression = node.value?.expression;

                if (expression?.type === 'VOnExpression') {
                    expression = expression.body.length === 1 && expression.body[0].type === 'ExpressionStatement'
                        ? expression.body[0].expression : undefined;
                }

                expression = unwrapExpression(expression);
                const call = expression?.type === 'CallExpression' ? expression : undefined;

                if (isMethodReference(call?.callee ?? expression) && !hasInlineLogic(expression, call)) {
                    return;
                }

                context.report({
                    node: node.value ?? node,
                    messageId: 'singleMethod',
                    fix(fixer) {
                        if (expression?.type !== 'ArrowFunctionExpression' || expression.async
                            || expression.params.length !== 0 || expression.typeParameters || expression.returnType) {
                            return null;
                        }

                        const body = unwrapExpression(expression.body);
                        const tokens = services.getTemplateBodyTokenStore().getTokens(expression, { includeComments: true });

                        if (body?.type !== 'CallExpression' || !isMethodReference(body.callee)
                            || hasInlineLogic(body, body) || tokens.some(function (token) {
                                return ['Line', 'Block', 'HTMLComment'].includes(token.type)
                                    || ['this', 'super', 'arguments', 'eval', '$event'].includes(token.value);
                            })) {
                            return null;
                        }

                        return fixer.replaceText(expression, sourceCode.getText(body));
                    },
                });
            },
        });
    },
};
