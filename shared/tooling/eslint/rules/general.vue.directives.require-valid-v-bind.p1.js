import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
const VALID_MODIFIERS = new Set([
    "prop",
    "camel",
    "sync",
    "attr"
]);

export default {
    meta: {
        type: "problem",
        description: 'Use valid v-bind modifiers and provide a value or valid same-name shorthand.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unsupportedModifier": "'v-bind' directives don't support the modifier '{{name}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedValue": "'v-bind' directives require an attribute value." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='bind']"(node) {
            for (const modifier of node.key.modifiers) if (!VALID_MODIFIERS.has(modifier.name)) context.report({
                node: modifier,
                data: { name: modifier.name },
                messageId: "unsupportedModifier"
            });
            if (!utils.isVBindSameNameShorthand(node) && (!node.value || utils.isEmptyValueDirective(node, context))) context.report({
                node,
                messageId: "expectedValue"
            });
        } });
    },
};
