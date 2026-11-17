const { g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Ban inner template interpolation spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "expectedBefore": "Expected space(s) before '}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedAfter": "Expected space(s) after '${'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedBefore": "Unexpected space(s) before '}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedAfter": "Unexpected space(s) after '${'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["never"];
        const [style] = ruleOptions;
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

        const sourceCode = context.sourceCode;
        const always = style === "always";
        function checkSpacingBefore(token) {
            if (!token.value.startsWith("}")) return;
            const prevToken = sourceCode.getTokenBefore(token, { includeComments: true });
            const hasSpace = sourceCode.isSpaceBetween(prevToken, token);
            if (!(0, import_ast_utils.isTokenOnSameLine)(prevToken, token)) return;
            if (always && !hasSpace) context.report({
                loc: {
                    start: token.loc.start,
                    end: {
                        line: token.loc.start.line,
                        column: token.loc.start.column + 1
                    }
                },
                fix: safeFix(null, (fixer) => fixer.insertTextBefore(token, " ")),
                messageId: "expectedBefore"
            });
            if (!always && hasSpace) context.report({
                loc: {
                    start: prevToken.loc.end,
                    end: token.loc.start
                },
                fix: safeFix(null, (fixer) => fixer.removeRange([prevToken.range[1], token.range[0]])),
                messageId: "unexpectedBefore"
            });
        }
        function checkSpacingAfter(token) {
            if (!token.value.endsWith("${")) return;
            const nextToken = sourceCode.getTokenAfter(token, { includeComments: true });
            const hasSpace = sourceCode.isSpaceBetween(token, nextToken);
            if (!(0, import_ast_utils.isTokenOnSameLine)(token, nextToken)) return;
            if (always && !hasSpace) context.report({
                loc: {
                    start: {
                        line: token.loc.end.line,
                        column: token.loc.end.column - 2
                    },
                    end: token.loc.end
                },
                fix: safeFix(null, (fixer) => fixer.insertTextAfter(token, " ")),
                messageId: "expectedAfter"
            });
            if (!always && hasSpace) context.report({
                loc: {
                    start: token.loc.end,
                    end: nextToken.loc.start
                },
                fix: safeFix(null, (fixer) => fixer.removeRange([token.range[1], nextToken.range[0]])),
                messageId: "unexpectedAfter"
            });
        }
        return { TemplateElement(node) {
            const token = sourceCode.getFirstToken(node);
            checkSpacingBefore(token);
            checkSpacingAfter(token);
        } };
    },
};
