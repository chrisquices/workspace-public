import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Keep at most one Vue component definition per file.',
        includeInReadme: true,
        schema: [],
        messages: {
            "tooManyComponents": "Keep one component definition per file. Move other components into separate files, preserving their imports, exports, and behavior."
        },
    },
    create(context) {

        const components = [];
        return Object.assign({}, utils.executeOnVueComponent(context, (node, type) => {
            if (type === "definition") {
                if (utils.getVueComponentDefinitionType(context, node) === "mixin") return;
            }
            components.push(node);
        }), { "Program:exit"() {
            if (components.length > 1) for (const node of components) context.report({
                node,
                messageId: "tooManyComponents"
            });
        } });
    },
};
