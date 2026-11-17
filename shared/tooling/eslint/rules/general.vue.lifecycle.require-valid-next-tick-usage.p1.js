import require_index from "eslint-plugin-vue/dist/utils/index.js";
import _eslint_community_eslint_utils from "@eslint-community/eslint-utils";
const utils = require_index.default;
function getVueNextTickNode(identifier, context) {
    if (identifier.parent.type === "MemberExpression" && (identifier.name === "$nextTick" && utils.isThis(identifier.parent.object, context) || identifier.name === "nextTick" && identifier.parent.object.type === "Identifier" && identifier.parent.object.name === "Vue")) return identifier.parent;
    const variable = (0, _eslint_community_eslint_utils.findVariable)(utils.getScope(context, identifier), identifier);
    if (variable != null && variable.defs.length === 1) {
        const def = variable.defs[0];
        if (def.type === "ImportBinding" && def.node.type === "ImportSpecifier" && def.node.imported.type === "Identifier" && def.node.imported.name === "nextTick" && def.node.parent.type === "ImportDeclaration" && def.node.parent.source.value === "vue") return identifier;
    }
}
function isAwaitedPromise(callExpression) {
    switch (callExpression.parent.type) {
        case "AwaitExpression": return true;
        case "ReturnStatement": return true;
        case "ArrowFunctionExpression": return callExpression.parent.body === callExpression;
        case "MemberExpression": return callExpression.parent.property.type === "Identifier" && callExpression.parent.property.name === "then";
        case "VariableDeclarator":
        case "AssignmentExpression": return true;
        case "ArrayExpression": return callExpression.parent.parent.type === "CallExpression" && callExpression.parent.parent.callee.type === "MemberExpression" && callExpression.parent.parent.callee.object.type === "Identifier" && callExpression.parent.parent.callee.object.name === "Promise" && callExpression.parent.parent.callee.property.type === "Identifier";
    }
    return false;
}

export default {
    meta: {
        type: "problem",
        description: 'Use nextTick with a callback or handle its promise, preserving the intended timing.',
        includeInReadme: true,
        schema: [],
        fixable: "code",
        messages: {
            "shouldBeFunction": "`nextTick` is a function." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingCallbackOrAwait": "Await the Promise returned by `nextTick` or pass a callback function." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "addAwait": "Add missing `await` statement." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "tooManyParameters": "`nextTick` expects zero or one parameters." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "eitherAwaitOrCallback": "Either await the Promise or pass a callback function to `nextTick`." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {
                const expression = target?.parent?.type === "MemberExpression" ? target.parent : target;
                if (expression?.parent?.type !== "AwaitExpression") return null;
                const result = change(fixer);
                if (!result) return null;
                const edits = result.range ? [result] : [...result];
                for (const edit of edits) {
                    const before = sourceForFixes.text.slice(...edit.range);

                    for (const comment of commentsForFixes) {
                        if (edit.range[0] < comment.range[1] && edit.range[1] > comment.range[0]
                            && !edit.text.includes(sourceForFixes.getText(comment))) return null;
                        if (/eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u.test(comment.value)
                            && /[\r\n]/u.test(before + edit.text)) {
                            const first = sourceForFixes.getLocFromIndex(edit.range[0]).line;
                            const last = sourceForFixes.getLocFromIndex(edit.range[1]).line;
                            if (first <= comment.loc.end.line + 1 && last >= comment.loc.start.line - 1) return null;
                        }
                    }
                }
                return edits;
            };
        }

        return utils.defineVueVisitor(context, { Identifier(node) {
            const nextTickNode = getVueNextTickNode(node, context);
            if (!nextTickNode || !nextTickNode.parent) return;
            let parentNode = nextTickNode.parent;
            if (parentNode.type === "ConditionalExpression") parentNode = parentNode.parent;
            if (parentNode.type === "CallExpression" && parentNode.callee !== nextTickNode || parentNode.type === "VariableDeclarator" || parentNode.type === "AssignmentExpression") return;
            if (parentNode.type !== "CallExpression") {
                context.report({
                    node,
                    fix: safeFix(node, function (fixer) {
                        return fixer.insertTextAfter(node, "()");
                    }),
                    messageId: "shouldBeFunction"
                });
                return;
            }
            if (parentNode.arguments.length === 0) {
                if (!isAwaitedPromise(parentNode)) context.report({
                    node,
                    messageId: "missingCallbackOrAwait"
                });
                return;
            }
            if (parentNode.arguments.length > 1) {
                context.report({
                    node,
                    messageId: "tooManyParameters"
                });
                return;
            }
            if (isAwaitedPromise(parentNode)) context.report({
                node,
                messageId: "eitherAwaitOrCallback"
            });
        } });
    },
};
