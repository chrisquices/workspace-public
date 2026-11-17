import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use v-else after a conditional branch, without a value, argument, modifier, or conflicting condition.',
        includeInReadme: true,
        schema: [],
        messages: {
            "missingVIf": "'v-else' directives require being preceded by the element which has a 'v-if' or 'v-else-if' directive." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "withVIf": "'v-else' and 'v-if' directives can't exist on the same element. You may want 'v-else-if' directives." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "withVElseIf": "'v-else' and 'v-else-if' directives can't exist on the same element." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedArgument": "'v-else' directives require no argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedModifier": "'v-else' directives require no modifier." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedValue": "'v-else' directives require no attribute value." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='else']"(node) {
            const element = node.parent.parent;
            if (!utils.prevElementHasIf(element)) context.report({
                node,
                messageId: "missingVIf"
            });
            if (utils.hasDirective(element, "if")) context.report({
                node,
                messageId: "withVIf"
            });
            if (utils.hasDirective(element, "else-if")) context.report({
                node,
                messageId: "withVElseIf"
            });
            if (node.key.argument) context.report({
                node: node.key.argument,
                messageId: "unexpectedArgument"
            });
            const lastModifier = node.key.modifiers.at(-1);
            if (lastModifier) context.report({
                node,
                loc: {
                    start: node.key.modifiers[0].loc.start,
                    end: lastModifier.loc.end
                },
                messageId: "unexpectedModifier"
            });
            if (node.value) context.report({
                node: node.value,
                messageId: "unexpectedValue"
            });
        } });
    },
};
