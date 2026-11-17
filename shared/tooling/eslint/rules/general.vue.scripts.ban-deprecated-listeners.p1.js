import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not use the deprecated Vue $listeners property.',
        includeInReadme: true,
        schema: [],
        messages: {
            "deprecated": "Replace the deprecated $listeners usage with Vue 3 attribute and listener handling. Review $attrs and declared emits, and preserve forwarding behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { VExpressionContainer(node) {
            for (const reference of node.references) {
                if (reference.variable != null) continue;
                if (reference.id.name === "$listeners") context.report({
                    node: reference.id,
                    messageId: "deprecated"
                });
            }
        } }, utils.defineVueVisitor(context, { MemberExpression(node) {
            if (node.property.type !== "Identifier" || node.property.name !== "$listeners" || !utils.isThis(node.object, context)) return;
            context.report({
                node: node.property,
                messageId: "deprecated"
            });
        } }));
    },
};
