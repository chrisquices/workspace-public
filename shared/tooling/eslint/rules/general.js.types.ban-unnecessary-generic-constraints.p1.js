// Unconstrained type parameters already accept any type.
// Keep correction manual so generic-arrow disambiguation and comments survive.

export default {
    meta: {
        type: "suggestion",
        description: 'Do not constrain generic type parameters with extends any or extends unknown.',
        includeInReadme: true,
        schema: [],
        messages: {
            constraint: "Remove the unnecessary extends {{constraint}} constraint from {{name}}. Preserve comments and defaults, including any trailing comma needed to parse a generic arrow function.",
        },
    },

    create(context) {
        return {
            "TSTypeParameter[constraint]"(node) {
                const constraint = node.constraint.type === "TSAnyKeyword" ? "any"
                    : node.constraint.type === "TSUnknownKeyword" ? "unknown" : null;

                if (!constraint) return;

                context.report({
                    node: node,
                    messageId: "constraint",
                    data: { name: node.name.name, constraint: constraint },
                });
            },
        };
    },
};
