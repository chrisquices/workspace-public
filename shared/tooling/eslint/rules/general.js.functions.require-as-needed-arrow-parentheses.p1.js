const { g: import_ast_utils, w: canTokensBeAdjacent } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
function hasBlockBody(node) {
    return node.body.type === "BlockStatement";
}

export default {
    meta: {
        type: "layout",
        description: 'Omit parentheses around a single untyped arrow parameter unless the body is a block.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "unexpectedParens": "Unexpected parentheses around single function argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedParens": "Expected parentheses around arrow function argument." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedParensInline": "Unexpected parentheses around single function argument having a body with no curly braces." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedParensBlock": "Expected parentheses around arrow function argument having a body with curly braces." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["as-needed",{"requireForBlockBody":true}];
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

        const asNeeded = style === "as-needed";
        const requireForBlockBody = asNeeded && options?.requireForBlockBody === true;
        const sourceCode = context.sourceCode;
        function findOpeningParenOfParams(node) {
            const tokenBeforeParams = sourceCode.getTokenBefore(node.params[0]);
            if (tokenBeforeParams && (0, import_ast_utils.isOpeningParenToken)(tokenBeforeParams) && node.range[0] <= tokenBeforeParams.range[0]) return tokenBeforeParams;
            return null;
        }
        function getClosingParenOfParams(node) {
            return sourceCode.getTokenAfter(node.params[0], import_ast_utils.isClosingParenToken);
        }
        function hasCommentsInParensOfParams(node, openingParen) {
            return sourceCode.commentsExistBetween(openingParen, getClosingParenOfParams(node));
        }
        function hasUnexpectedTokensBeforeOpeningParen(node, openingParen) {
            const expectedCount = node.async ? 1 : 0;
            return sourceCode.getFirstToken(node, { skip: expectedCount }) !== openingParen;
        }
        return { "ArrowFunctionExpression[params.length=1]": function(node) {
            const shouldHaveParens = !asNeeded || requireForBlockBody && hasBlockBody(node);
            const openingParen = findOpeningParenOfParams(node);
            const hasParens = openingParen !== null;
            const [param] = node.params;
            if (shouldHaveParens && !hasParens) context.report({
                node,
                loc: param.loc,
                fix: safeFix(node, function* (fixer) {
                    yield fixer.insertTextBefore(param, "(");
                    yield fixer.insertTextAfter(param, ")");
                }),
                messageId: requireForBlockBody ? "expectedParensBlock" : "expectedParens"
            });
            if (!shouldHaveParens && hasParens && param.type === "Identifier" && !param.optional && !param.typeAnnotation && !node.returnType && !hasCommentsInParensOfParams(node, openingParen) && !hasUnexpectedTokensBeforeOpeningParen(node, openingParen)) context.report({
                node,
                loc: param.loc,
                fix: safeFix(node, function* (fixer) {
                    const tokenBeforeOpeningParen = sourceCode.getTokenBefore(openingParen);
                    const closingParen = getClosingParenOfParams(node);
                    if (tokenBeforeOpeningParen && tokenBeforeOpeningParen.range[1] === openingParen.range[0] && !canTokensBeAdjacent(tokenBeforeOpeningParen, sourceCode.getFirstToken(param))) yield fixer.insertTextBefore(openingParen, " ");
                    yield fixer.removeRange([openingParen.range[0], param.range[0]]);
                    yield fixer.removeRange([param.range[1], closingParen.range[1]]);
                }),
                messageId: requireForBlockBody ? "unexpectedParensInline" : "unexpectedParens"
            });
        } };
    },
};
