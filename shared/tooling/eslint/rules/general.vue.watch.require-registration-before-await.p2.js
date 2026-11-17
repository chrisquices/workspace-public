import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
function isMaybeUsedStopHandle(node) {
    const parent = node.parent;
    if (parent) switch (parent.type) {
        case "VariableDeclarator": return true;
        case "AssignmentExpression": return true;
        case "CallExpression": return true;
        case "Property": return true;
        case "ArrayExpression": return true;
        case "ChainExpression": return isMaybeUsedStopHandle(parent);
    }
    return false;
}

export default {
    meta: {
        type: "suggestion",
        description: 'Register watchers before await in async setup unless their stop handle is retained.',
        includeInReadme: true,
        schema: [],
        messages: {
            "forbidden": "`watch` is forbidden after an `await` expression." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const watchCallNodes = new Set();
        const setupScopes = new Map();
        let scopeStack = null;
        return utils.compositingVisitors({ Program(program) {
            const tracker = new _eslint_community_eslint_utils.ReferenceTracker(utils.getScope(context, program));
            const watchRefs = utils.iterateReferencesTraceMap(tracker, {
                watch: { [_eslint_community_eslint_utils.ReferenceTracker.CALL]: true },
                watchEffect: { [_eslint_community_eslint_utils.ReferenceTracker.CALL]: true }
            });
            for (const { node } of watchRefs) watchCallNodes.add(node);
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
                if (!setupScope || !setupScope.afterAwait || !utils.inRange(setupScope.range, node)) return;
                if (watchCallNodes.has(node) && !isMaybeUsedStopHandle(node)) context.report({
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
