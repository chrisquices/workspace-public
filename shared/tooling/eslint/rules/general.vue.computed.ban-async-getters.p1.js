import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
const PROMISE_FUNCTIONS = new Set([
    "then",
    "catch",
    "finally"
]);
const PROMISE_METHODS = new Set([
    "all",
    "allSettled",
    "any",
    "race",
    "reject",
    "resolve",
    "try",
    "withResolvers"
]);
const TIMED_FUNCTIONS = new Set([
    "setTimeout",
    "setInterval",
    "setImmediate",
    "requestAnimationFrame"
]);
function isTimedFunction(node) {
    const callee = utils.skipChainExpression(node.callee);
    return (callee.type === "Identifier" && TIMED_FUNCTIONS.has(callee.name) || callee.type === "MemberExpression" && callee.object.type === "Identifier" && callee.object.name === "window" && TIMED_FUNCTIONS.has(utils.getStaticPropertyName(callee) || "")) && node.arguments.length > 0;
}
function skipWrapper(node) {
    while (node && node.expression) node = node.expression;
    return node;
}
function resolveRootObjectStep(current) {
    switch (current.type) {
        case "MemberExpression": return {
            done: false,
            next: skipWrapper(current.object)
        };
        case "CallExpression": {
            const calleeExpr = skipWrapper(current.callee);
            if (calleeExpr.type === "MemberExpression") return {
                done: false,
                next: skipWrapper(calleeExpr.object)
            };
            return {
                done: true,
                name: calleeExpr.type === "Identifier" ? calleeExpr.name : null
            };
        }
        case "Identifier": return {
            done: true,
            name: current.name
        };
        default: return {
            done: true,
            name: null
        };
    }
}
function getRootObjectName(memberExpr) {
    let current = skipWrapper(memberExpr.object);
    while (current) {
        const step = resolveRootObjectStep(current);
        if (step.done) return step.name;
        current = step.next;
    }
    return null;
}
function isPromiseMethod(name, callee) {
    return PROMISE_FUNCTIONS.has(name) || callee.object.type === "Identifier" && callee.object.name === "Promise" && PROMISE_METHODS.has(name);
}
function isPromise(node, ignoredObjectNames) {
    const callee = utils.skipChainExpression(node.callee);
    if (callee.type === "MemberExpression") {
        const name = utils.getStaticPropertyName(callee);
        if (!name || !isPromiseMethod(name, callee)) return false;
        const rootObjectName = getRootObjectName(callee);
        return !rootObjectName || !ignoredObjectNames.has(rootObjectName);
    }
    return false;
}
function isNextTick(node, context) {
    const callee = utils.skipChainExpression(node.callee);
    if (callee.type === "MemberExpression") {
        const name = utils.getStaticPropertyName(callee);
        return utils.isThis(callee.object, context) && name === "$nextTick" || callee.object.type === "Identifier" && callee.object.name === "Vue" && name === "nextTick";
    }
    return false;
}

export default {
    meta: {
        type: "problem",
        description: 'Keep computed getters synchronous.',
        includeInReadme: true,
        schema: [],
        messages: {
            "unexpectedInFunction": "Unexpected {{expressionName}} in computed function." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedInProperty": "Unexpected {{expressionName}} in \"{{propertyName}}\" computed property." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"ignoredObjectNames":[]}];

        const options = ruleOptions[0] || {};
        const ignoredObjectNames = new Set(options.ignoredObjectNames || []);
        const computedPropertiesMap = new Map();
        const computedFunctionNodes = [];
        let scopeStack = null;
        const expressionTypes = {
            promise: "asynchronous action",
            nextTick: "asynchronous action",
            await: "await operator",
            async: "async function declaration",
            new: "Promise object",
            timed: "timed function"
        };
        function onFunctionEnter(node, info) {
            if (node.async) verify(node, node.body, "async", info ? computedPropertiesMap.get(info.node) : null);
            scopeStack = {
                upper: scopeStack,
                body: node.body
            };
        }
        function onFunctionExit() {
            scopeStack &&= scopeStack.upper;
        }
        function verify(node, targetBody, type, computedProperties) {
            const properties = computedProperties || [];
            for (const cp of properties) if (cp.value && node.loc.start.line >= cp.value.loc.start.line && node.loc.end.line <= cp.value.loc.end.line && targetBody === cp.value) {
                context.report({
                    node,
                    data: {
                        expressionName: expressionTypes[type],
                        propertyName: cp.key || "unknown"
                    },
                    messageId: "unexpectedInProperty"
                });
                return;
            }
            for (const cf of computedFunctionNodes) if (node.loc.start.line >= cf.body.loc.start.line && node.loc.end.line <= cf.body.loc.end.line && targetBody === cf.body) {
                context.report({
                    node,
                    data: { expressionName: expressionTypes[type] },
                    messageId: "unexpectedInFunction"
                });
                return;
            }
        }
        const nodeVisitor = {
            ":function": onFunctionEnter,
            ":function:exit": onFunctionExit,
            NewExpression(node, info) {
                if (!scopeStack) return;
                if (node.callee.type === "Identifier" && node.callee.name === "Promise") verify(node, scopeStack.body, "new", info ? computedPropertiesMap.get(info.node) : null);
            },
            CallExpression(node, info) {
                if (!scopeStack) return;
                if (isPromise(node, ignoredObjectNames)) verify(node, scopeStack.body, "promise", info ? computedPropertiesMap.get(info.node) : null);
                else if (isTimedFunction(node)) verify(node, scopeStack.body, "timed", info ? computedPropertiesMap.get(info.node) : null);
                else if (isNextTick(node, context)) verify(node, scopeStack.body, "nextTick", info ? computedPropertiesMap.get(info.node) : null);
            },
            AwaitExpression(node, info) {
                if (!scopeStack) return;
                verify(node, scopeStack.body, "await", info ? computedPropertiesMap.get(info.node) : null);
            }
        };
        return utils.compositingVisitors({ Program(program) {
            const tracker = new _eslint_community_eslint_utils.ReferenceTracker(utils.getScope(context, program));
            const computedRefs = utils.iterateReferencesTraceMap(tracker, { computed: { [_eslint_community_eslint_utils.ReferenceTracker.CALL]: true } });
            for (const { node } of computedRefs) {
                if (node.type !== "CallExpression") continue;
                const getter = utils.getGetterBodyFromComputedFunction(node);
                if (getter) computedFunctionNodes.push(getter);
            }
        } }, utils.isScriptSetup(context) ? utils.defineScriptSetupVisitor(context, nodeVisitor) : utils.defineVueVisitor(context, {
            onVueObjectEnter(node) {
                computedPropertiesMap.set(node, utils.getComputedProperties(node));
            },
            ...nodeVisitor
        }));
    },
};
