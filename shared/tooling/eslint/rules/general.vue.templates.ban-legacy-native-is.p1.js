import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not use legacy is bindings on native elements; static vue: component references are allowed.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpected": "The `is` attribute on HTML element are deprecated." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        function isValidElement(node) {
            return !utils.isHtmlWellKnownElementName(node.rawName) && !utils.isSvgWellKnownElementName(node.rawName) && !utils.isMathWellKnownElementName(node.rawName);
        }
        return utils.defineTemplateBodyVisitor(context, {
            "VAttribute[directive=true][key.name.name='bind'][key.argument.name='is']"(node) {
                if (isValidElement(node.parent.parent)) return;
                context.report({
                    node,
                    loc: node.loc,
                    messageId: "unexpected"
                });
            },
            "VAttribute[directive=false][key.name='is']"(node) {
                if (isValidElement(node.parent.parent) || node.value?.value.startsWith("vue:")) return;
                context.report({
                    node,
                    loc: node.loc,
                    messageId: "unexpected"
                });
            }
        });
    },
};
