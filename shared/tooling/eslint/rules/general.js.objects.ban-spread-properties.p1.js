// Object literals must name their properties explicitly instead of merging
// another object's properties through spread syntax. This applies equally to
// calls and variables, including Vue template expressions. Array/argument spreads
// and destructuring rest are outside this rule. Nesting changes access paths,
// while explicit flattening can affect getters and evaluation order, so fixes
// require a manual decision rather than an automatic rewrite.

export default {
    meta: {
        type: 'suggestion',
        description: 'Use explicit properties instead of object spreads.',
        includeInReadme: true,
        schema: [],
        messages: {
            spread: 'Replace the spread with explicit properties. Preserve property precedence, getter behavior, and evaluation order. If the source shape is unknown, ask the developer.',
        },
    },

    create(context) {
        const visitor = {
            ObjectExpression(node) {
                for (const property of node.properties) {
                    if (property.type !== 'SpreadElement') continue;

                    context.report({
                        node: property,
                        messageId: 'spread',
                    });
                }
            },
        };

        return context.sourceCode.parserServices.defineTemplateBodyVisitor?.(visitor, visitor) ?? visitor;
    },
};
