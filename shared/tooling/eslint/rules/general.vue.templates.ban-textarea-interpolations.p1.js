import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use value bindings or v-model instead of textarea interpolations.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpected": "Replace this textarea interpolation with a value binding or v-model as appropriate. Preserve whether the value is read-only or editable."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VElement[rawName='textarea'] VExpressionContainer"(node) {
            if (node.parent.type !== "VElement") return;
            context.report({
                node,
                loc: node.loc,
                messageId: "unexpected"
            });
        } });
    },
};
