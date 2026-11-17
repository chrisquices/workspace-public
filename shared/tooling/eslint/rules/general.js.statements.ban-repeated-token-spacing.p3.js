const { g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Ban repeated token spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "multipleSpaces": "Multiple spaces found before '{{displayValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"exceptions":{"Property":true,"ImportAttribute":true},"ignoreEOLComments":false,"includeTabs":true}];
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

        const { ignoreEOLComments, exceptions, includeTabs } = options;
        const sourceCode = context.sourceCode;
        const hasExceptions = Object.keys(exceptions).some((key) => exceptions[key]);
        const spacesRe = includeTabs ? /[ \t]{2}/ : / {2}/;
        function formatReportedCommentValue(token) {
            const valueLines = token.value.split("\n");
            const value = valueLines[0];
            const formattedValue = `${value.slice(0, 12)}...`;
            return valueLines.length === 1 && value.length <= 12 ? value : formattedValue;
        }
        return { Program() {
            sourceCode.tokensAndComments.forEach((leftToken, leftIndex, tokensAndComments) => {
                if (leftIndex === tokensAndComments.length - 1) return;
                const rightToken = tokensAndComments[leftIndex + 1];
                if (!spacesRe.test(sourceCode.text.slice(leftToken.range[1], rightToken.range[0])) || leftToken.loc.end.line < rightToken.loc.start.line) return;
                if (ignoreEOLComments && (0, import_ast_utils.isCommentToken)(rightToken) && (leftIndex === tokensAndComments.length - 2 || rightToken.loc.end.line < tokensAndComments[leftIndex + 2].loc.start.line)) return;
                if (hasExceptions) {
                    const parentNode = sourceCode.getNodeByRangeIndex(rightToken.range[0] - 1);
                    if (parentNode && exceptions[parentNode.type]) return;
                }
                let displayValue;
                if (rightToken.type === "Block") displayValue = `/*${formatReportedCommentValue(rightToken)}*/`;
                else if (rightToken.type === "Line") displayValue = `//${formatReportedCommentValue(rightToken)}`;
                else displayValue = rightToken.value;
                context.report({
                    node: rightToken,
                    loc: {
                        start: leftToken.loc.end,
                        end: rightToken.loc.start
                    },
                    data: { displayValue },
                    fix: safeFix(rightToken, (fixer) => fixer.replaceTextRange([leftToken.range[1], rightToken.range[0]], " ")),
                    messageId: "multipleSpaces"
                });
            });
        } };
    },
};
