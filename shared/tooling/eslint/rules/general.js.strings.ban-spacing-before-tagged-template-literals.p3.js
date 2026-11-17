export default {
    meta: {
        type: "layout",
        description: "Ban spacing before tagged template literals.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpected": "Unexpected space between template tag and template literal." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missing": "Missing space between template tag and template literal." + " Correct this violation while preserving comments, binding scope, and behavior."
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

        const never = style !== "always";
        const sourceCode = context.sourceCode;
        function checkSpacing(node) {
            const tagToken = sourceCode.getTokenBefore(node.quasi);
            const literalToken = sourceCode.getFirstToken(node.quasi);
            const hasWhitespace = sourceCode.isSpaceBetween(tagToken, literalToken);
            if (never && hasWhitespace) context.report({
                node,
                loc: {
                    start: tagToken.loc.end,
                    end: literalToken.loc.start
                },
                fix: safeFix(node, function (fixer) {
                    const comments = sourceCode.getCommentsBefore(node.quasi);
                    if (comments.some((comment) => comment.type === "Line")) return null;
                    return fixer.replaceTextRange([tagToken.range[1], literalToken.range[0]], comments.reduce((text, comment) => text + sourceCode.getText(comment), ""));
                }),
                messageId: "unexpected"
            });
            else if (!never && !hasWhitespace) context.report({
                node,
                loc: {
                    start: node.loc.start,
                    end: literalToken.loc.start
                },
                fix: safeFix(node, function (fixer) {
                    return fixer.insertTextAfter(tagToken, " ");
                }),
                messageId: "missing"
            });
        }
        return { TaggedTemplateExpression: checkSpacing };
    },
};
