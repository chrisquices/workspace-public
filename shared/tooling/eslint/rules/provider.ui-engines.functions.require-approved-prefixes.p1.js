const prefixes = [
    'add', 'apply', 'call', 'clamp', 'clear', 'collect', 'create', 'decrease',
    'deselect', 'disable', 'enable', 'enter', 'exit', 'find', 'format', 'get',
    'handle', 'has', 'hide', 'increase', 'is', 'list', 'load', 'open', 'parse',
    'read', 'register', 'remove', 'replace', 'report', 'reset', 'revoke',
    'resolve', 'resume', 'rotate', 'save', 'scroll', 'seek', 'select', 'set',
    'settle', 'should', 'show', 'start', 'sync', 'toggle', 'validate', 'zoom',
    'notify', 'reject', 'approve',
];
const wholeWords = new Set([
    'play', 'pause', 'stop', 'retry', 'destroy', 'init', 'notify', 'subscribe', 'unsubscribe', 'flush',
]);
const prefixPattern = new RegExp(`^(?:${prefixes.join('|')})(?:[A-Z]|$)`);
const expressionWrappers = new Set([
    'TSAsExpression', 'TSTypeAssertion', 'TSSatisfiesExpression', 'TSNonNullExpression',
]);

export default {
    meta: {
        type: 'suggestion',
        description: 'Name UI engine functions with approved action prefixes or whole-word verbs.',
        includeInReadme: true,
        schema: [],
        messages: {
            invalid: 'Function "{{name}}" must use an approved prefix or whole-word verb. Rename it using the approved vocabulary and update its references. Allowed prefixes: {{prefixes}}. Whole-word exceptions: {{wholeWords}}.',
        },
    },

    create(context) {
        function validateName(identifier) {
            if (!identifier || wholeWords.has(identifier.name) || prefixPattern.test(identifier.name)) return;

            context.report({
                node: identifier,
                messageId: 'invalid',
                data: {
                    name: identifier.name,
                    prefixes: prefixes.join(', '),
                    wholeWords: [...wholeWords].join(', '),
                },
            });
        }

        function validateFunction(node) {
            validateName(node.id);

            let expression = node;
            while (expressionWrappers.has(expression.parent?.type)) {
                expression = expression.parent;
            }

            const parent = expression.parent;
            if (parent?.type === 'VariableDeclarator' && parent.init === expression && parent.id.type === 'Identifier') {
                validateName(parent.id);
            }
        }

        return {
            FunctionDeclaration: validateFunction,
            FunctionExpression: validateFunction,
            ArrowFunctionExpression: validateFunction,
            TSDeclareFunction: validateFunction,
        };
    },
};
