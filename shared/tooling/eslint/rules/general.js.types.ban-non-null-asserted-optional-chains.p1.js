export default {
    meta: {
        type: 'problem',
        description: 'Do not use non-null assertions on optional chain results.',
        includeInReadme: true,
        schema: [],
        messages: {
            "noNonNullOptionalChain": 'Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong.' + " Correct this violation while preserving comments, binding scope, and behavior.",
            "suggestRemovingNonNull": 'You should remove the non-null assertion.' + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return {
            // non-nulling a wrapped chain will scrub all nulls introduced by the chain
            // (x?.y)!
            // (x?.())!
            'TSNonNullExpression > ChainExpression'(node) {
                context.report({
                    node,
                    messageId: 'noNonNullOptionalChain'
                });
            },
            // non-nulling at the end of a chain will scrub all nulls introduced by the chain
            // x?.y!
            // x?.()!
            'ChainExpression > TSNonNullExpression'(node) {
                context.report({
                    node,
                    messageId: 'noNonNullOptionalChain'
                });
            },
        };
    },
};
