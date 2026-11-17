import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Put keys on real elements rather than non-loop template tags.',
        includeInReadme: true,
        schema: [],
        messages: {
            "disallow": "'<template>' cannot be keyed. Place the key on real elements instead." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VElement[name='template']"(node) {
            const keyNode = utils.getAttribute(node, "key") || utils.getDirective(node, "bind", "key");
            if (!keyNode || utils.hasDirective(node, "for")) return;
            context.report({
                node: keyNode,
                loc: keyNode.loc,
                messageId: "disallow"
            });
        } });
    },
};
