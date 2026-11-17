import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
function getCalleeMemberNode(node) {
    const callee = utils.skipChainExpression(node.callee);
    if (callee.type === "MemberExpression") {
        const name = utils.getStaticPropertyName(callee);
        if (name) return {
            name,
            member: callee
        };
    }
    return null;
}

export default {
    meta: {
        type: "problem",
        description: 'Call expose and defineExpose before await in setup.',
        includeInReadme: true,
        schema: [],
        messages: {
            "forbidden": "`{{name}}` is forbidden after an `await` expression." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        const setupScopes = new Map();
        let scopeStack = null;
        return utils.compositingVisitors({ Program(node) {
            scopeStack = {
                upper: scopeStack,
                scopeNode: node
            };
        } }, {
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
                const { isContextReferenceId, isExposeReferenceId } = setupScope;
                if (node.callee.type === "Identifier" && isExposeReferenceId(node.callee, node)) context.report({
                    node,
                    data: { name: node.callee.name },
                    messageId: "forbidden"
                });
                else {
                    const expose = getCalleeMemberNode(node);
                    if (expose && expose.name === "expose" && expose.member.object.type === "Identifier" && isContextReferenceId(expose.member.object)) context.report({
                        node,
                        data: { name: expose.name },
                        messageId: "forbidden"
                    });
                }
            }
        }, (() => {
            const scriptSetup = utils.getScriptSetupElement(context);
            if (!scriptSetup) return {};
            return { Program(node) {
                setupScopes.set(node, {
                    afterAwait: false,
                    range: scriptSetup.range,
                    isExposeReferenceId: (id, callNode) => callNode.parent.type === "ExpressionStatement" && callNode.parent.parent === node && id.name === "defineExpose",
                    isContextReferenceId: () => false
                });
            } };
        })(), utils.defineVueVisitor(context, {
            onSetupFunctionEnter(node) {
                const contextParam = node.params[1];
                if (!contextParam || contextParam.type === "RestElement" || contextParam.type === "ArrayPattern") return;
                const contextReferenceIds = new Set();
                const exposeReferenceIds = new Set();
                if (contextParam.type === "ObjectPattern") {
                    const exposeProperty = utils.findAssignmentProperty(contextParam, "expose");
                    if (!exposeProperty) return;
                    const exposeParam = exposeProperty.value;
                    const variable = exposeParam.type === "Identifier" ? (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, exposeParam), exposeParam) : null;
                    if (!variable) return;
                    for (const reference of variable.references) {
                        if (!reference.isRead()) continue;
                        exposeReferenceIds.add(reference.identifier);
                    }
                } else if (contextParam.type === "Identifier") {
                    const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, contextParam), contextParam);
                    if (!variable) return;
                    for (const reference of variable.references) {
                        if (!reference.isRead()) continue;
                        contextReferenceIds.add(reference.identifier);
                    }
                }
                setupScopes.set(node, {
                    afterAwait: false,
                    range: node.range,
                    isExposeReferenceId: (id) => exposeReferenceIds.has(id),
                    isContextReferenceId: (id) => contextReferenceIds.has(id)
                });
            },
            onSetupFunctionExit(node) {
                setupScopes.delete(node);
            }
        }));
    },
};
