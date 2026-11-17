export default {
    meta: {
        type: 'suggestion',
        description: 'Use functions instead of classes in UI engine code.',
        includeInReadme: true,
        schema: [],
        messages: {
            forbidden: 'Use functions instead of classes in engine code.',
        },
    },

    create(context) {
        function reportClass(node) {
            context.report({node, messageId: 'forbidden'});
        }

        return {
            ClassDeclaration: reportClass,
            ClassExpression: reportClass,
        };
    },
};
