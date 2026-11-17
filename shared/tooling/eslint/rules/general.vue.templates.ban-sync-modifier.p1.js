import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use v-model arguments instead of the deprecated .sync modifier.',
        includeInReadme: true,
        schema: [],
        messages: {
            "syncModifierIsDeprecated": "'.sync' modifier on 'v-bind' directive is deprecated. Use 'v-model:propName' instead." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='bind']"(node) {
            if (node.key.modifiers.map((mod) => mod.name).includes("sync")) context.report({
                node,
                loc: node.loc,
                messageId: "syncModifierIsDeprecated"
            });
        } });
    },
};
