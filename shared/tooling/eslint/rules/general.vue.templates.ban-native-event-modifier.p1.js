import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not use the deprecated .native event modifier.',
        includeInReadme: true,
        schema: [],
        messages: {
            "deprecated": "'.native' modifier on 'v-on' directive is deprecated." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='on'] > VDirectiveKey > VIdentifier[name='native']"(node) {
            if (!node.parent.modifiers.includes(node)) return;
            context.report({
                node,
                messageId: "deprecated"
            });
        } });
    },
};
