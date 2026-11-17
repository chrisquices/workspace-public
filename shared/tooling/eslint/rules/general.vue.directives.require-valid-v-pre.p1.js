import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use v-pre without a value, argument, or modifier.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpectedArgument": "'v-pre' directives require no argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedModifier": "'v-pre' directives require no modifier." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedValue": "'v-pre' directives require no attribute value." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='pre']"(node) {
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
