import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not use the removed inline-template attribute.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpected": "Remove the obsolete inline-template attribute. Move content into the component or a supported slot, preserving scope and behavior."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=false] > VIdentifier[rawName='inline-template']"(node) {
            context.report({
                node,
                loc: node.loc,
                messageId: "unexpected"
            });
        } });
    },
};
