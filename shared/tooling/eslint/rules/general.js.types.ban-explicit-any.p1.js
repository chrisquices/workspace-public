// Report explicit any, including rest parameters and keyof any.
// Another rule reports extends any constraints; that syntax remains banned.

export default {
    meta: {
        type: "suggestion",
        description: "Ban explicit any types; require a meaningful type or unknown with narrowing.",
        includeInReadme: true,
        schema: [],
        messages: {
            any: "Replace explicit any with a precise type or unknown and appropriate narrowing. Preserve the type's intent; rest parameters need an array type, and keyof any can use PropertyKey.",
        },
    },

    create(context) {
        return {
            TSAnyKeyword(node) {
                if (node.parent.type === "TSTypeParameter" && node.parent.constraint === node) return;

                context.report({ node: node, messageId: "any" });
            },
        };
    },
};
