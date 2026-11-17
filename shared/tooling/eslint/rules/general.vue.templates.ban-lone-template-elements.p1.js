import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
const SPECIAL_TEMPLATE_DIRECTIVES = new Set([
    "if",
    "else",
    "else-if",
    "for",
    "slot"
]);
function getKeyName(attr) {
    if (attr.directive) return attr.key.name.name !== "bind" || !attr.key.argument || attr.key.argument.type === "VExpressionContainer" ? null : attr.key.argument.name;
    return attr.key.name;
}

export default {
    meta: {
        type: "problem",
        description: 'Use nested template elements only for structural directives or slots.',
        includeInReadme: true,
        schema: [],
        messages: {
            "requireDirective": "`<template>` require directive." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"ignoreAccessible":false}];

        const shouldIgnoreAccessible = (ruleOptions[0] || {}).ignoreAccessible === true;
        return utils.defineTemplateBodyVisitor(context, { "VElement[name='template'][parent.type='VElement'] > VStartTag"(node) {
            if (node.attributes.some((attr) => {
                if (attr.directive) {
                    const directiveName = attr.key.name.name;
                    if (directiveName === "slot-scope" || directiveName === "scope" || SPECIAL_TEMPLATE_DIRECTIVES.has(directiveName)) return true;
                }
                return getKeyName(attr) === "slot";
            }) || shouldIgnoreAccessible && node.attributes.some((attr) => {
                const keyName = getKeyName(attr);
                return keyName === "id" || keyName === "ref";
            })) return;
            context.report({
                node,
                messageId: "requireDirective"
            });
        } });
    },
};
