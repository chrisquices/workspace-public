import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function isValidBindAppear(vBindAppear) {
    return !vBindAppear.value?.expression || vBindAppear.value.expression.type !== "Literal" || vBindAppear.value.expression.value !== false;
}
function createDirectiveList(directives) {
    let str = "";
    for (const [index, directive] of directives.entries()) if (index === 0) str += `\`v-${directive}\``;
    else if (index < directives.length - 1) str += `, \`v-${directive}\``;
    else str += ` or \`v-${directive}\``;
    return str;
}

export default {
    meta: {
        type: "problem",
        description: 'Give transition children an appropriate visibility condition or key.',
        includeInReadme: true,
        schema: [],
        messages: {
            "expected": "The element inside `<transition>` is expected to have a {{allowedDirectives}} directive." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [];

        const allowedDirectives = [
            "if",
            "show",
            ...ruleOptions[0] && ruleOptions[0].additionalDirectives || []
        ];
        const allowedDirectivesString = createDirectiveList(allowedDirectives);
        /**
        * Check if the given element has display control.
        */
        function verifyInsideElement(element) {
            if (utils.isCustomComponent(element)) return;
            const parent = element.parent;
            const vBindAppear = utils.getDirective(parent, "bind", "appear");
            if (utils.hasAttribute(parent, "appear") || vBindAppear && isValidBindAppear(vBindAppear)) return;
            if (element.name !== "slot" && allowedDirectives.every((directive) => !utils.hasDirective(element, directive)) && !utils.hasDirective(element, "bind", "key")) context.report({
                node: element.startTag,
                loc: element.startTag.loc,
                data: { allowedDirectives: allowedDirectivesString },
                messageId: "expected"
            });
        }
        return utils.defineTemplateBodyVisitor(context, { "VElement[name='transition'] > VElement"(node) {
            if (node.parent.children.find(utils.isVElement) !== node) return;
            verifyInsideElement(node);
        } });
    },
};
