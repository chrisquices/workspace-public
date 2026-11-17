import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not use the deprecated functional attribute on Vue templates.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpected": "Remove the deprecated functional attribute from this Vue template. Review the component for Vue 3 compatibility and preserve its behavior."
        },
    },
    create(context) {

        return { Program(program) {
            const element = program.templateBody;
            if (element == null) return;
            const functional = utils.getAttribute(element, "functional");
            if (functional) context.report({
                node: functional,
                messageId: "unexpected"
            });
        } };
    },
};
