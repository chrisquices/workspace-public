export default {
    meta: {
        type: 'suggestion',
        description: 'Use local variables instead of this in UI engine code.',
        includeInReadme: true,
        schema: [],
        messages: {
            forbidden: 'Use local variables instead of `this` in engine code.',
        },
    },

    create(context) {
        return {
            ThisExpression(node) {
                context.report({node, messageId: 'forbidden'});
            },
        };
    },
};
