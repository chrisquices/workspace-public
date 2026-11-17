import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function isFunctionIdentifier(node) {
    return node !== null && node.type === "Identifier" && node.name === "Function";
}
function hasFunctionType(node) {
    return isFunctionIdentifier(node) || node.type === "ArrayExpression" && node.elements.some(isFunctionIdentifier);
}

export default {
    meta: {
        type: "problem",
        description: 'Do not use component this inside prop default factories.',
        includeInReadme: true,
        schema: [],
        messages: {
            "deprecated": "Props default value factory functions no longer have access to `this`." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const propsDefault = new Set();
        let scopeStack = null;
        function onFunctionEnter(node) {
            if (node.type === "ArrowFunctionExpression") return;
            if (scopeStack) scopeStack = {
                upper: scopeStack,
                node,
                propDefault: false
            };
            else if (node.type === "FunctionExpression" && propsDefault.has(node)) scopeStack = {
                upper: scopeStack,
                node,
                propDefault: true
            };
        }
        function onFunctionExit(node) {
            if (scopeStack && scopeStack.node === node) scopeStack = scopeStack.upper;
        }
        return utils.defineVueVisitor(context, {
            onVueObjectEnter(node) {
                for (const prop of utils.getComponentPropsFromOptions(node)) {
                    if (prop.type !== "object" || prop.value.type !== "ObjectExpression") continue;
                    const def = utils.findProperty(prop.value, "default");
                    if (!def) continue;
                    const type = utils.findProperty(prop.value, "type");
                    if (type && hasFunctionType(type.value) || def.value.type !== "FunctionExpression") continue;
                    propsDefault.add(def.value);
                }
            },
            ":function": onFunctionEnter,
            ":function:exit": onFunctionExit,
            ThisExpression(node) {
                if (scopeStack && scopeStack.propDefault) context.report({
                    node,
                    messageId: "deprecated"
                });
            }
        });
    },
};
