import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function isUsingIterationVar(vFor, vBindKey) {
    if (vBindKey.value == null) return false;
    const references = vBindKey.value.references;
    const variables = vFor.parent.parent.variables;
    return references.some((reference) => variables.some((variable) => variable.id.name === reference.id.name && variable.kind === "v-for"));
}

export default {
    meta: {
        type: "problem",
        description: 'Put a loop-dependent key on its template v-for owner, not a direct child.',
        includeInReadme: true,
        schema: [],
        messages: {
            "vForTemplateKeyPlacement": "`<template v-for>` key should be placed on the `<template>` tag." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VElement[name='template'] > VStartTag > VAttribute[directive=true][key.name.name='for']"(node) {
            const template = node.parent.parent;
            const vBindKeyOnTemplate = utils.getDirective(template, "bind", "key");
            if (vBindKeyOnTemplate && isUsingIterationVar(node, vBindKeyOnTemplate)) return;
            for (const child of template.children) {
                if (!utils.isVElement(child) || utils.hasDirective(child, "if") || utils.hasDirective(child, "else-if") || utils.hasDirective(child, "else") || utils.hasDirective(child, "for")) continue;
                const vBindKeyOnChild = utils.getDirective(child, "bind", "key");
                if (vBindKeyOnChild && isUsingIterationVar(node, vBindKeyOnChild)) context.report({
                    node: vBindKeyOnChild,
                    loc: vBindKeyOnChild.loc,
                    messageId: "vForTemplateKeyPlacement"
                });
            }
        } });
    },
};
