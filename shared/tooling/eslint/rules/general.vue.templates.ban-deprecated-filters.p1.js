import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use functions or computed values instead of deprecated Vue template filters.',
        includeInReadme: true,
        schema: [],
        messages: {
            "noDeprecatedFilter": "Filters are deprecated." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { VFilterSequenceExpression(node) {
            context.report({
                node,
                loc: node.loc,
                messageId: "noDeprecatedFilter"
            });
        } });
    },
};
