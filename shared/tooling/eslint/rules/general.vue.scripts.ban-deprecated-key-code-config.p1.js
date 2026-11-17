import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not use the deprecated Vue.config.keyCodes configuration.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpected": "`Vue.config.keyCodes` are deprecated." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return { "MemberExpression[property.type='Identifier'][property.name='keyCodes']"(node) {
            const config = utils.skipChainExpression(node.object);
            if (config.type !== "MemberExpression" || config.property.type !== "Identifier" || config.property.name !== "config" || config.object.type !== "Identifier" || config.object.name !== "Vue") return;
            context.report({
                node,
                messageId: "unexpected"
            });
        } };
    },
};
