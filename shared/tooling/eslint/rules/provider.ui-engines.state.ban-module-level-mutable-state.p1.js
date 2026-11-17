export default {
    meta: {
        type: 'suggestion',
        description: 'Keep mutable UI engine state inside functions.',
        includeInReadme: true,
        schema: [],
        messages: {
            forbidden: 'Move mutable state inside the engine function. Do not declare {{kind}} outside functions.',
        },
    },

    create(context) {
        return {
            VariableDeclaration(node) {
                if (node.kind !== 'let' && node.kind !== 'var') return;

                for (let parent = node.parent; parent; parent = parent.parent) {
                    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(parent.type)) return;
                }

                context.report({node, messageId: 'forbidden', data: {kind: node.kind}});
            },
        };
    },
};
