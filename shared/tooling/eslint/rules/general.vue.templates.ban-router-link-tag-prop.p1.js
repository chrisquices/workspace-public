import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
const utils = require_index.default;
function getComponentNames(context) {
    const components = context.options[0] && context.options[0].components ? context.options[0].components : ["RouterLink"];
    return new Set(components.flatMap((component) => [require_casing.kebabCase(component), require_casing.pascalCase(component)]));
}

export default {
    meta: {
        type: "problem",
        description: 'Use the RouterLink slot API instead of its deprecated tag prop.',
        includeInReadme: true,
        schema: [],
        messages: {
            "deprecated": "'tag' property on '{{element}}' component is deprecated. Use scoped slots instead." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const components = getComponentNames(context);
        return utils.defineTemplateBodyVisitor(context, { VElement(node) {
            if (!components.has(node.rawName)) return;
            let tagKey = null;
            const tagAttr = utils.getAttribute(node, "tag");
            if (tagAttr) tagKey = tagAttr.key;
            else {
                const directive = utils.getDirective(node, "bind", "tag");
                if (directive) {
                    const arg = directive.key.argument;
                    if (arg && arg.type === "VIdentifier") tagKey = arg;
                }
            }
            if (tagKey) context.report({
                node: tagKey,
                data: { element: node.rawName },
                messageId: "deprecated"
            });
        } });
    },
};
