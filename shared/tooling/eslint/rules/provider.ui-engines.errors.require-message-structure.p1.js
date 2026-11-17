const errorNames = new Set([
    'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
    'URIError', 'EvalError', 'AggregateError',
]);

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ChainExpression'].includes(node.type)) {
        node = node.expression;
    }
    return node;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Use template literals ending in a period for standard JavaScript error messages.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            template: 'Use a template literal for the {{name}} message. Replace the message expression with backticks, preserving its value.',
            period: 'End the {{name}} message with a literal period (.) after any interpolation.',
            missing: 'Provide a template-literal message ending with a period for {{name}}.',
        },
    },

    create(context) {
        function isGlobal(identifier) {
            let scope = context.sourceCode.getScope(identifier);
            while (scope) {
                const variable = scope.set.get(identifier.name);
                if (variable) return variable.defs.length === 0;
                scope = scope.upper;
            }
            return true;
        }

        function validateError(node) {
            const callee = unwrap(node.callee);
            let name;
            if (callee.type === 'Identifier' && isGlobal(callee)) {
                name = callee.name;
            } else if (callee.type === 'MemberExpression') {
                const object = unwrap(callee.object);
                if (object.type !== 'Identifier' || object.name !== 'globalThis' || !isGlobal(object)) return;
                name = callee.computed ? callee.property.value : callee.property.name;
            }
            if (!errorNames.has(name)) return;

            const index = name === 'AggregateError' ? 1 : 0;
            if (node.arguments.slice(0, index + 1).some(argument => argument.type === 'SpreadElement')) return;
            const message = unwrap(node.arguments[index]);
            if (!message) {
                context.report({node, messageId: 'missing', data: {name}});
                return;
            }
            if (message.type === 'TemplateLiteral') {
                const ending = message.quasis.at(-1).value.cooked;
                if (!ending?.endsWith('.')) {
                    context.report({node: message, messageId: 'period', data: {name}});
                }
                return;
            }
            if (message.type === 'Literal' && typeof message.value === 'string' && !message.value.endsWith('.')) {
                context.report({node: message, messageId: 'period', data: {name}});
            }

            context.report({
                node: message,
                messageId: 'template',
                data: {name},
                fix(fixer) {
                    if (message.type !== 'Literal' || typeof message.value !== 'string') return null;

                    const text = JSON.stringify(message.value).slice(1, -1)
                        .replace(/\\"/g, '"')
                        .replace(/`/g, '\\`')
                        .replace(/\$\{/g, '\\${');
                    return fixer.replaceText(message, '`' + text + '`');
                },
            });
        }

        return {
            NewExpression: validateError,
            CallExpression: validateError,
        };
    },
};
