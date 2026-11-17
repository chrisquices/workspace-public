import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Replace deprecated v-is with an explicit or dynamic component.',
        includeInReadme: true,
        schema: [],
        messages: {
            forbiddenVIs: "Replace deprecated v-is with an explicit component or <component :is=\"...\"> in this Vue file. Preserve bindings and native DOM parsing constraints; choose the replacement manually."
        },
    },
    create(context) {

        return utils.defineTemplateBodyVisitor(context, {
            "VAttribute[directive=true][key.name.name='is']"(node) {
                context.report({ node: node.key, messageId: "forbiddenVIs" });
            },
        });
    },
};
