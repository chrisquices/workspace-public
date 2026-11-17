import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function isFalsy(node) {
    if (node.type === "Literal") {
        if (node.bigint) return node.bigint === "0";
        if (!node.value) return true;
    }
    return node.type === "Identifier" && (node.name === "undefined" || node.name === "NaN");
}

export default {
    meta: {
        type: "problem",
        description: 'Return a value capable of being truthy from Vue emits validators.',
        includeInReadme: true,
        schema: [],
        messages: {
            "expectedTrue": "Expected to return a true value in \"{{name}}\" emits validator." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedBoolean": "Expected to return a boolean value in \"{{name}}\" emits validator." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const emitsValidators = [];
        let scopeStack = null;
        function processEmits(emits) {
            for (const emit of emits) {
                if (emit.type !== "object" || !emit.value || emit.value.type !== "FunctionExpression" && emit.value.type !== "ArrowFunctionExpression") continue;
                emitsValidators.push(emit);
            }
        }
        return utils.compositingVisitors(utils.defineScriptSetupVisitor(context, { onDefineEmitsEnter(_node, emits) {
            processEmits(emits);
        } }), utils.defineVueVisitor(context, { onVueObjectEnter(obj) {
            processEmits(utils.getComponentEmitsFromOptions(obj));
        } }), {
            ":function"(node) {
                scopeStack = {
                    upper: scopeStack,
                    functionNode: node,
                    hasReturnValue: false,
                    possibleOfReturnTrue: false
                };
                if (!(node.type === "ArrowFunctionExpression" && node.expression)) return;
                scopeStack.hasReturnValue = true;
                if (!isFalsy(node.body)) scopeStack.possibleOfReturnTrue = true;
            },
            ReturnStatement(node) {
                if (!scopeStack || !node.argument) return;
                scopeStack.hasReturnValue = true;
                if (!isFalsy(node.argument)) scopeStack.possibleOfReturnTrue = true;
            },
            ":function:exit"(node) {
                if (scopeStack && !scopeStack.possibleOfReturnTrue) {
                    const emits = emitsValidators.find((e) => e.value === node);
                    if (emits) context.report({
                        node,
                        data: { name: emits.emitName || "Unknown" },
                        messageId: scopeStack.hasReturnValue ? "expectedTrue" : "expectedBoolean"
                    });
                }
                scopeStack &&= scopeStack.upper;
            }
        });
    },
};
