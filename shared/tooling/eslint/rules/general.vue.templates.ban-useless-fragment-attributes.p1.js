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
function isFragmentTemplateAttribute(attr) {
    if (attr.directive) {
        const directiveName = attr.key.name.name;
        if (directiveName === "slot-scope" || directiveName === "scope" || SPECIAL_TEMPLATE_DIRECTIVES.has(directiveName)) return true;
    }
    return getKeyName(attr) === "slot";
}

export default {
    meta: {
        type: "problem",
        description: 'Move ineffective attributes from Vue fragment templates to appropriate elements.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpectedAttr": "Unexpected useless attribute on `<template>`." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedDir": "Unexpected useless directive on `<template>`." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VElement[name='template'][parent.type='VElement'] > VStartTag"(node) {
            if (!node.attributes.some(isFragmentTemplateAttribute)) return;
            for (const attr of node.attributes) {
                if (isFragmentTemplateAttribute(attr)) continue;
                if (getKeyName(attr) === "key") continue;
                context.report({
                    node: attr,
                    messageId: attr.directive ? "unexpectedDir" : "unexpectedAttr"
                });
            }
        } });
    },
};
