import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Do not access computed properties in data initializers.',
        includeInReadme: true,
        schema: [],
        messages: {
            "cannotBeUsed": "The computed property cannot be used in `data()` because it is before initialization." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const contextMap = new Map();
        let scopeStack = null;
        return utils.compositingVisitors({
            ":function"(node) {
                scopeStack = {
                    upper: scopeStack,
                    node
                };
            },
            ":function:exit"() {
                scopeStack &&= scopeStack.upper;
            }
        }, utils.defineVueVisitor(context, {
            onVueObjectEnter(node) {
                const dataProperty = utils.findProperty(node, "data");
                if (!dataProperty || dataProperty.value.type !== "FunctionExpression" && dataProperty.value.type !== "ArrowFunctionExpression") return;
                const computedNames = new Set();
                const computedProperties = utils.iterateProperties(node, new Set(["computed"]));
                for (const computed of computedProperties) computedNames.add(computed.name);
                contextMap.set(node, {
                    data: dataProperty.value,
                    computedNames
                });
            },
            MemberExpression(node, vueData) {
                if (!scopeStack || !utils.isThis(node.object, context)) return;
                const ctx = contextMap.get(vueData.node);
                if (!ctx || ctx.data !== scopeStack.node) return;
                const name = utils.getStaticPropertyName(node);
                if (!name || !ctx.computedNames.has(name)) return;
                context.report({
                    node,
                    messageId: "cannotBeUsed"
                });
            }
        }));
    },
};
