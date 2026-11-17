import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
const deletedImportApisMap = {
    set: { [_eslint_community_eslint_utils.ReferenceTracker.CALL]: true },
    del: { [_eslint_community_eslint_utils.ReferenceTracker.CALL]: true }
};
const deprecatedApis = new Set(["set", "delete"]);
const deprecatedDollarApis = new Set(["$set", "$delete"]);
function isVue(node) {
    return node.type === "Identifier" && node.name === "Vue";
}

export default {
    meta: {
        type: "problem",
        description: 'Do not use deprecated Vue set and delete reactivity helpers.',
        includeInReadme: true,
        schema: [],
        messages: {
            "deprecated": "The `$delete`, `$set` is deprecated." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {

        function getVueDeprecatedCallExpression(identifier, context) {
            return identifier.parent.type === "MemberExpression" && identifier.parent.parent.type === "CallExpression" && identifier.parent.parent.callee === identifier.parent && (deprecatedDollarApis.has(identifier.name) && utils.isThis(identifier.parent.object, context) || deprecatedApis.has(identifier.name) && isVue(identifier.parent.object)) ? identifier.parent.parent : void 0;
        }
        const nodeVisitor = { Identifier(node) {
            if (!getVueDeprecatedCallExpression(node, context)) return;
            context.report({
                node,
                messageId: "deprecated"
            });
        } };
        return utils.compositingVisitors(utils.defineVueVisitor(context, nodeVisitor), utils.defineScriptSetupVisitor(context, nodeVisitor), { Program(node) {
            const tracker = new _eslint_community_eslint_utils.ReferenceTracker(utils.getScope(context, node));
            const esmTraceMap = { vue: {
                [_eslint_community_eslint_utils.ReferenceTracker.ESM]: true,
                ...deletedImportApisMap
            } };
            const cjsTraceMap = { vue: { ...deletedImportApisMap } };
            for (const { node } of [...tracker.iterateEsmReferences(esmTraceMap), ...tracker.iterateCjsReferences(cjsTraceMap)]) {
                const refNode = node;
                context.report({
                    node: refNode.callee,
                    messageId: "deprecated"
                });
            }
        } });
    },
};
