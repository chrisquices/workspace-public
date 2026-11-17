const expressionWrappers = new Set([
    'TSAsExpression', 'TSTypeAssertion', 'TSSatisfiesExpression', 'TSNonNullExpression',
]);

export default {
    meta: {
        type: 'suggestion',
        description: 'Use function declarations instead of assigned function expressions in UI engines.',
        includeInReadme: true,
        schema: [],
        messages: {
            forbidden: 'Use a function declaration instead of assigning a function expression to "{{name}}". Preserve references and initialization behavior.',
        },
    },

    create(context) {
        return {
            FunctionExpression(node) {
                let expression = node;
                while (expressionWrappers.has(expression.parent?.type)) {
                    expression = expression.parent;
                }

                const parent = expression.parent;
                let identifier;
                if (parent.type === 'VariableDeclarator' && parent.init === expression && parent.id.type === 'Identifier') {
                    identifier = parent.id;
                } else if (parent.type === 'AssignmentExpression' && parent.right === expression && parent.left.type === 'Identifier') {
                    identifier = parent.left;
                }

                if (identifier) context.report({node, messageId: 'forbidden', data: {name: identifier.name}});
            },
        };
    },
};
