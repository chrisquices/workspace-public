import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Return a value from Vue render functions.',
        includeInReadme: true,
        schema: [],
        messages: {
            "expectedReturn": "Expected to return a value in render function." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const renderFunctions = new Map();
        return utils.compositingVisitors(utils.defineVueVisitor(context, { onRenderFunctionEnter(node) {
            renderFunctions.set(node, node.parent.key);
        } }), utils.executeOnFunctionsWithoutReturn(context, true, (node) => {
            const key = renderFunctions.get(node);
            if (key) context.report({
                node: key,
                messageId: "expectedReturn"
            });
        }));
    },
};
