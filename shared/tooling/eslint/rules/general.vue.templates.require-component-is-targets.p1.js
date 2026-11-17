import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Give dynamic component elements a bound is target.',
        includeInReadme: true,
        schema: [],
        messages: {
            "requireComponentIs": "Expected '<component>' elements to have 'v-bind:is' attribute." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VElement[name='component']"(node) {
            if (!utils.hasDirective(node, "bind", "is")) context.report({
                node,
                loc: node.loc,
                messageId: "requireComponentIs"
            });
        } });
    },
};
