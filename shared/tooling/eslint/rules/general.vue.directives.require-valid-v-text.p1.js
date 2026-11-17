import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use v-text with an expression, without arguments or modifiers.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpectedArgument": "'v-text' directives require no argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedModifier": "'v-text' directives require no modifier." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedValue": "'v-text' directives require that attribute value." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='text']"(node) {
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
            if (!node.value || utils.isEmptyValueDirective(node, context)) context.report({
                node,
                messageId: "expectedValue"
            });
        } });
    },
};
