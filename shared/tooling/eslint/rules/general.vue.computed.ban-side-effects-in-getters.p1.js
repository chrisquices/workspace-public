import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Keep computed getters free of side effects.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpectedSideEffectInFunction": "Unexpected side effect in computed function." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSideEffectInProperty": "Unexpected side effect in \"{{key}}\" computed property." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const computedPropertiesMap = new Map();
        const computedCallNodes = [];
        const setupRanges = [];
        let scopeStack = null;
        function onFunctionEnter(node) {
            scopeStack = {
                upper: scopeStack,
                body: node.body
            };
        }
        function onFunctionExit() {
            scopeStack &&= scopeStack.upper;
        }
        const nodeVisitor = {
            ":function": onFunctionEnter,
            ":function:exit": onFunctionExit,
            "MemberExpression > :matches(Identifier, ThisExpression)"(node, info) {
                if (!scopeStack) return;
                const targetBody = scopeStack.body;
                const computedProperty = (info ? computedPropertiesMap.get(info.node) || [] : []).find((cp) => cp.value && cp.value.range[0] <= node.range[0] && node.range[1] <= cp.value.range[1] && targetBody === cp.value);
                if (computedProperty) {
                    const mem = node.parent;
                    if (mem.object !== node) return;
                    const isThis = utils.isThis(node, context);
                    const isVue = node.type === "Identifier" && node.name === "Vue";
                    const invalid = mem.parent.type === "CallExpression" && mem.property.type === "Identifier" && (isThis && mem.property.name === "$set" || isVue && mem.property.name === "set") ? { node: mem.property } : isThis && utils.findMutating(mem);
                    if (invalid) context.report({
                        node: invalid.node,
                        data: { key: computedProperty.key || "Unknown" },
                        messageId: "unexpectedSideEffectInProperty"
                    });
                    return;
                }
                if (node.type === "ThisExpression") return;
                const computedFunction = computedCallNodes.find((c) => c.range[0] <= node.range[0] && node.range[1] <= c.range[1] && targetBody === c.body);
                if (!computedFunction) return;
                if (node.parent.object !== node) return;
                const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, node), node);
                if (!variable || variable.defs.length !== 1) return;
                const def = variable.defs[0];
                if ([
                    "ImplicitGlobalVariable",
                    "TDZ",
                    "ImportBinding"
                ].includes(def.type)) return;
                if (!setupRanges.some(([start, end]) => start <= def.node.range[0] && def.node.range[1] <= end) || computedFunction.range[0] <= def.node.range[0] && def.node.range[1] <= computedFunction.range[1]) return;
                const invalid = utils.findMutating(node);
                if (invalid) context.report({
                    node: invalid.node,
                    messageId: "unexpectedSideEffectInFunction"
                });
            }
        };
        const scriptSetupNode = utils.getScriptSetupElement(context);
        if (scriptSetupNode) setupRanges.push(scriptSetupNode.range);
        return utils.compositingVisitors({ Program(program) {
            const tracker = new _eslint_community_eslint_utils.ReferenceTracker(utils.getScope(context, program));
            const computedRefs = utils.iterateReferencesTraceMap(tracker, { computed: { [_eslint_community_eslint_utils.ReferenceTracker.CALL]: true } });
            for (const { node } of computedRefs) {
                if (node.type !== "CallExpression") continue;
                const getterBody = utils.getGetterBodyFromComputedFunction(node);
                if (getterBody) computedCallNodes.push(getterBody);
            }
        } }, scriptSetupNode ? utils.defineScriptSetupVisitor(context, nodeVisitor) : utils.defineVueVisitor(context, {
            onVueObjectEnter(node) {
                computedPropertiesMap.set(node, utils.getComputedProperties(node));
            },
            onSetupFunctionEnter(node) {
                setupRanges.push(node.body.range);
            },
            ...nodeVisitor
        }));
    },
};
