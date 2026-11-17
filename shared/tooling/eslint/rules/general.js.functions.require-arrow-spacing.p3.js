const { g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: 'Use spaces around arrow operators.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "expectedBefore": "Missing space before =>." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedBefore": "Unexpected space before =>." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedAfter": "Missing space after =>." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedAfter": "Unexpected space after =>." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"before":true,"after":true}];
        const [option] = ruleOptions;
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
        function getArrow(node) {
            if (node.type === "ArrowFunctionExpression") return sourceCode.getTokenBefore(node.body, import_ast_utils.isArrowToken);
            else return sourceCode.getFirstToken(node.returnType, import_ast_utils.isArrowToken);
        }
        function spaces(node) {
            const arrowToken = getArrow(node);
            const beforeToken = sourceCode.getTokenBefore(arrowToken, { includeComments: true });
            const isSpacedBefore = sourceCode.isSpaceBetween(beforeToken, arrowToken);
            if (option.before) {
                if (!isSpacedBefore) context.report({
                    node: beforeToken,
                    fix: safeFix(beforeToken, function (fixer) {
                        return fixer.insertTextBefore(arrowToken, " ");
                    }),
                    messageId: "expectedBefore"
                });
            } else if (isSpacedBefore) context.report({
                node: beforeToken,
                fix: safeFix(beforeToken, function (fixer) {
                    return fixer.removeRange([beforeToken.range[1], arrowToken.range[0]]);
                }),
                messageId: "unexpectedBefore"
            });
            const afterToken = sourceCode.getTokenAfter(arrowToken, { includeComments: true });
            const isSpacedAfter = sourceCode.isSpaceBetween(arrowToken, afterToken);
            if (option.after) {
                if (!isSpacedAfter) context.report({
                    node: afterToken,
                    fix: safeFix(afterToken, function (fixer) {
                        return fixer.insertTextAfter(arrowToken, " ");
                    }),
                    messageId: "expectedAfter"
                });
            } else if (isSpacedAfter) context.report({
                node: afterToken,
                fix: safeFix(afterToken, function (fixer) {
                    return fixer.removeRange([arrowToken.range[1], afterToken.range[0]]);
                }),
                messageId: "unexpectedAfter"
            });
        }
        return {
            ArrowFunctionExpression: spaces,
            TSFunctionType: spaces,
            TSConstructorType: spaces
        };
    },
};
