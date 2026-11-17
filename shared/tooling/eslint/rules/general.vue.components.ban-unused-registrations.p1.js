import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
const utils = require_index.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Remove unused component registrations after checking dynamic usage.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unused": "The \"{{name}}\" component has been registered but not used." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"ignoreWhenBindingPresent":true}];

        const ignoreWhenBindingPresent = (ruleOptions[0] || {}).ignoreWhenBindingPresent ?? true;
        const usedComponents = new Set();
        let registeredComponents = [];
        let shouldIgnoreReporting = false;
        let templateLocation;
        return utils.defineTemplateBodyVisitor(context, {
            VElement(node) {
                if (!utils.isHtmlElementNode(node) && !utils.isSvgElementNode(node) && !utils.isMathElementNode(node) || utils.isHtmlWellKnownElementName(node.rawName) || utils.isSvgWellKnownElementName(node.rawName) || utils.isMathWellKnownElementName(node.rawName)) return;
                usedComponents.add(node.rawName);
            },
            "VAttribute[directive=true][key.name.name='bind'][key.argument.name='is'], VAttribute[directive=true][key.name.name='is']"(node) {
                if (!node.value || node.value.type !== "VExpressionContainer" || !node.value.expression) return;
                if (node.value.expression.type === "Literal") usedComponents.add(node.value.expression.value);
                else if (ignoreWhenBindingPresent) shouldIgnoreReporting = true;
            },
            "VAttribute[directive=false][key.name='is']"(node) {
                if (!node.value) return;
                const value = node.value.value.startsWith("vue:") ? node.value.value.slice(4) : node.value.value;
                usedComponents.add(value);
            },
            "VElement[name='template']"(node) {
                templateLocation ||= node.loc.start;
            },
            "VElement[name='template']:exit"(node) {
                if (shouldIgnoreReporting || node.loc.start !== templateLocation || utils.hasAttribute(node, "src")) return;
                for (const { node, name } of registeredComponents) {
                    if (require_casing.isPascalCase(name) || require_casing.isCamelCase(name)) {
                        if ([...usedComponents].some((n) => !n.includes("_") && (name === require_casing.pascalCase(n) || name === require_casing.camelCase(n)))) continue;
                    } else if (usedComponents.has(name)) continue;
                    context.report({
                        node,
                        data: { name },
                        messageId: "unused"
                    });
                }
            }
        }, utils.executeOnVue(context, (obj) => {
            registeredComponents = utils.getRegisteredComponents(obj);
        }));
    },
};
