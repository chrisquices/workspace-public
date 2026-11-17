import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Use v-slot instead of deprecated scope attributes.',
        includeInReadme: true,
        schema: [],
        messages: {
            forbiddenScopeAttribute: "Replace this deprecated scope attribute with v-slot or #default on the owning slot template. Preserve the binding pattern, slot ownership, and references; do not introduce deprecated slot-scope syntax."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, {
            "VAttribute[directive=true] > VDirectiveKey[name.name='scope']"(node) {
                context.report({ node: node, messageId: "forbiddenScopeAttribute" });
            },
        });
    },
};
