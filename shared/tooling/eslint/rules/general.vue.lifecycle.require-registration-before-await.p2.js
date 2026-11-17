import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
const LIFECYCLE_HOOKS = [
    "onBeforeMount",
    "onBeforeUnmount",
    "onBeforeUpdate",
    "onErrorCaptured",
    "onMounted",
    "onRenderTracked",
    "onRenderTriggered",
    "onUnmounted",
    "onUpdated",
    "onActivated",
    "onDeactivated"
];

export default {
    meta: {
        type: "suggestion",
        description: 'Register lifecycle hooks before await in async setup functions.',
        includeInReadme: true,
        schema: [],
        messages: {
            "forbidden": "Lifecycle hooks are forbidden after an `await` expression." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const lifecycleHookCallNodes = new Set();
        const setupScopes = new Map();
        let scopeStack = null;
        return utils.compositingVisitors({ Program(program) {
            const tracker = new _eslint_community_eslint_utils.ReferenceTracker(utils.getScope(context, program));
            const traceMap = {};
            for (const lifecycleHook of LIFECYCLE_HOOKS) traceMap[lifecycleHook] = { [_eslint_community_eslint_utils.ReferenceTracker.CALL]: true };
            for (const { node } of utils.iterateReferencesTraceMap(tracker, traceMap)) lifecycleHookCallNodes.add(node);
        } }, utils.defineVueVisitor(context, {
            onSetupFunctionEnter(node) {
                setupScopes.set(node, {
                    afterAwait: false,
                    range: node.range
                });
            },
            ":function"(node) {
                scopeStack = {
                    upper: scopeStack,
                    scopeNode: node
                };
            },
            ":function:exit"() {
                scopeStack &&= scopeStack.upper;
            },
            AwaitExpression(node) {
                if (!scopeStack) return;
                const setupScope = setupScopes.get(scopeStack.scopeNode);
                if (!setupScope || !utils.inRange(setupScope.range, node)) return;
                setupScope.afterAwait = true;
            },
            CallExpression(node) {
                if (!scopeStack) return;
                const setupScope = setupScopes.get(scopeStack.scopeNode);
                if (!setupScope?.afterAwait || !utils.inRange(setupScope.range, node) || !lifecycleHookCallNodes.has(node) || node.arguments.length >= 2) return;
                context.report({
                    node,
                    messageId: "forbidden"
                });
            },
            onSetupFunctionExit(node) {
                setupScopes.delete(node);
            }
        }));
    },
};
