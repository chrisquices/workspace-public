import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use v-if with an expression, without arguments, modifiers, or conflicting conditional directives.',
        includeInReadme: true,
        schema: [],
        messages: {
            "withVElse": "'v-if' and 'v-else' directives can't exist on the same element. You may want 'v-else-if' directives." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "withVElseIf": "'v-if' and 'v-else-if' directives can't exist on the same element." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedArgument": "'v-if' directives require no argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedModifier": "'v-if' directives require no modifier." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedValue": "'v-if' directives require that attribute value." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='if']"(node) {
            const element = node.parent.parent;
            if (utils.hasDirective(element, "else")) context.report({
                node,
                messageId: "withVElse"
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
            if (!node.value || utils.isEmptyValueDirective(node, context)) context.report({
                node,
                messageId: "expectedValue"
            });
        } });
    },
};
