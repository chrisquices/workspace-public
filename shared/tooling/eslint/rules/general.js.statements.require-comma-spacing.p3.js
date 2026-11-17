const { g: import_ast_utils, h: AST_TOKEN_TYPES } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require comma spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpected": `There should be no space {{loc}} ','.` + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missing": `A space is required {{loc}} ','.` + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"before":false,"after":true}];
        const [options] = ruleOptions;
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {

                const result = change(fixer);
                if (!result) return null;
                const newline = sourceForFixes.text.match(/\r\n|\n|\r/u)?.[0] ?? "\n";
                const edits = (result.range ? [result] : [...result]).map(function (edit) {
                    return { range: edit.range, text: edit.text.replace(/\r\n|\n|\r/gu, newline) };
                });
                for (const edit of edits) {
                    const before = sourceForFixes.text.slice(...edit.range);
                    if (before.replace(/\s/gu, "") !== edit.text.replace(/\s/gu, "")) return null;
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

        const { before: spaceBefore, after: spaceAfter } = options;
        const sourceCode = context.sourceCode;
        const tokensAndComments = sourceCode.tokensAndComments;
        const ignoredTokens = new Set();
        function addNullElementsToIgnoreList(node) {
            let previousToken = sourceCode.getFirstToken(node);
            for (const element of node.elements) {
                let token;
                if (element == null) {
                    token = sourceCode.getTokenAfter(previousToken);
                    if (token && (0, import_ast_utils.isCommaToken)(token)) ignoredTokens.add(token);
                } else token = sourceCode.getTokenAfter(element);
                previousToken = token;
            }
        }
        function addTypeParametersTrailingCommaToIgnoreList(node) {
            const paramLength = node.params.length;
            if (paramLength) {
                const param = node.params[paramLength - 1];
                const afterToken = sourceCode.getTokenAfter(param);
                if (afterToken && (0, import_ast_utils.isCommaToken)(afterToken)) ignoredTokens.add(afterToken);
            }
        }
        function validateCommaSpacing(commaToken, prevToken, nextToken) {
            if (prevToken && (0, import_ast_utils.isTokenOnSameLine)(prevToken, commaToken) && spaceBefore !== sourceCode.isSpaceBetween(prevToken, commaToken)) context.report({
                node: commaToken,
                data: { loc: "before" },
                fix: safeFix(commaToken, (fixer) => spaceBefore ? fixer.insertTextBefore(commaToken, " ") : fixer.replaceTextRange([prevToken.range[1], commaToken.range[0]], "")),
                messageId: spaceBefore ? "missing" : "unexpected"
            });
            if (nextToken && (0, import_ast_utils.isTokenOnSameLine)(commaToken, nextToken) && !(0, import_ast_utils.isClosingParenToken)(nextToken) && !(0, import_ast_utils.isClosingBracketToken)(nextToken) && !(0, import_ast_utils.isClosingBraceToken)(nextToken) && !(!spaceAfter && nextToken.type === AST_TOKEN_TYPES.Line) && spaceAfter !== sourceCode.isSpaceBetween(commaToken, nextToken)) context.report({
                node: commaToken,
                data: { loc: "after" },
                fix: safeFix(commaToken, (fixer) => spaceAfter ? fixer.insertTextAfter(commaToken, " ") : fixer.replaceTextRange([commaToken.range[1], nextToken.range[0]], "")),
                messageId: spaceAfter ? "missing" : "unexpected"
            });
        }
        return {
            "ArrayExpression": addNullElementsToIgnoreList,
            "ArrayPattern": addNullElementsToIgnoreList,
            "TSTypeParameterDeclaration": addTypeParametersTrailingCommaToIgnoreList,
            "Program:exit": function() {
                tokensAndComments.forEach((token, i) => {
                    if (!(0, import_ast_utils.isCommaToken)(token)) return;
                    const prevToken = tokensAndComments[i - 1];
                    const nextToken = tokensAndComments[i + 1];
                    validateCommaSpacing(token, (0, import_ast_utils.isCommaToken)(prevToken) || ignoredTokens.has(token) ? null : prevToken, nextToken && (0, import_ast_utils.isCommaToken)(nextToken) || ignoredTokens.has(token) ? null : nextToken);
                });
            }
        };
    },
};
