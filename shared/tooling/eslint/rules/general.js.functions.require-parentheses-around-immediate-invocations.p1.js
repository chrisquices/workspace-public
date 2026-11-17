const { A: getStaticPropertyName, U: isParenthesised, Z: skipChainExpression, g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
function isCalleeOfNewExpression(node) {
    const maybeCallee = node.parent?.type === "ChainExpression" ? node.parent : node;
    return maybeCallee.parent?.type === "NewExpression" && maybeCallee.parent.callee === maybeCallee;
}

export default {
    meta: {
        type: "layout",
        description: "Require parentheses around immediate function invocations.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "wrapInvocation": "Wrap an immediate function invocation in parentheses." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "wrapExpression": "Wrap only the function expression in parens." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "moveInvocation": "Move the invocation into the parens that contain the function." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["any",{"functionPrototypeMethods":true}];
        const [style, options] = ruleOptions;
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {

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

        const includeFunctionPrototypeMethods = options.functionPrototypeMethods;
        const sourceCode = context.sourceCode;
        function isWrappedInAnyParens(node) {
            return isParenthesised(sourceCode, node);
        }
        function isWrappedInGroupingParens(node) {
            return (0, import_ast_utils.isParenthesized)(node, sourceCode);
        }
        function getFunctionNodeFromIIFE(node) {
            const callee = skipChainExpression(node.callee);
            if (callee.type === "FunctionExpression") return callee;
            if (includeFunctionPrototypeMethods && callee.type === "MemberExpression" && callee.object.type === "FunctionExpression" && (getStaticPropertyName(callee) === "call" || getStaticPropertyName(callee) === "apply")) return callee.object;
            return null;
        }
        return { CallExpression(node) {
            const innerNode = getFunctionNodeFromIIFE(node);
            if (!innerNode) return;
            const isCallExpressionWrapped = isWrappedInAnyParens(node);
            const isFunctionExpressionWrapped = isWrappedInAnyParens(innerNode);
            if (!isCallExpressionWrapped && !isFunctionExpressionWrapped) context.report({
                node,
                fix: safeFix(node, function (fixer) {
                    const nodeToSurround = style === "inside" ? innerNode : node;
                    return fixer.replaceText(nodeToSurround, `(${sourceCode.getText(nodeToSurround)})`);
                }),
                messageId: "wrapInvocation"
            });
            else if (style === "inside" && !isFunctionExpressionWrapped) context.report({
                node,
                fix: safeFix(node, function (fixer) {
                    if (isWrappedInGroupingParens(node) && !isCalleeOfNewExpression(node)) {
                        const parenAfter = sourceCode.getTokenAfter(node);
                        return fixer.replaceTextRange([innerNode.range[1], parenAfter.range[1]], `)${sourceCode.getText().slice(innerNode.range[1], parenAfter.range[0])}`);
                    }
                    return fixer.replaceText(innerNode, `(${sourceCode.getText(innerNode)})`);
                }),
                messageId: "wrapExpression"
            });
            else if (style === "outside" && !isCallExpressionWrapped) context.report({
                node,
                fix: safeFix(node, function (fixer) {
                    const parenAfter = sourceCode.getTokenAfter(innerNode);
                    return fixer.replaceTextRange([parenAfter.range[0], node.range[1]], `${sourceCode.getText().slice(parenAfter.range[1], node.range[1])})`);
                }),
                messageId: "moveInvocation"
            });
        } };
    },
};
