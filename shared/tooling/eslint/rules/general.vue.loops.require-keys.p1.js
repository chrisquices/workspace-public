import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Give native elements in Vue loops bound keys.',
        includeInReadme: true,
        schema: [],
        messages: {
            "requireKey": "Elements in iteration expect to have 'v-bind:key' directives." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        /**
        * Check the given element about `v-bind:key` attributes.
        */
        function checkKey(element) {
            if (utils.hasDirective(element, "bind", "key")) return;
            if (element.name === "template" || element.name === "slot") {
                for (const child of element.children) if (child.type === "VElement") checkKey(child);
            } else if (!utils.isCustomComponent(element)) context.report({
                node: element.startTag,
                loc: element.startTag.loc,
                messageId: "requireKey"
            });
        }
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='for']"(node) {
            checkKey(node.parent.parent);
        } });
    },
};
