export default {
    meta: {
        type: "layout",
        description: "Require yield-star spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "missingBefore": "Missing space before *." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingAfter": "Missing space after *." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedBefore": "Unexpected space before *." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedAfter": "Unexpected space after *." + " Correct this violation while preserving comments, binding scope, and behavior."
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

        const sourceCode = context.sourceCode;
        const mode = (() => {
            if (typeof options === "string") return {
                before: {
                    before: true,
                    after: false
                },
                after: {
                    before: false,
                    after: true
                },
                both: {
                    before: true,
                    after: true
                },
                neither: {
                    before: false,
                    after: false
                }
            }[options];
            return options;
        })();
        function checkSpacing(side, leftToken, rightToken) {
            if (sourceCode.isSpaceBetween(leftToken, rightToken) !== mode[side]) {
                const after = leftToken.value === "*";
                const spaceRequired = mode[side];
                const node = after ? leftToken : rightToken;
                const messageId = spaceRequired ? side === "before" ? "missingBefore" : "missingAfter" : side === "before" ? "unexpectedBefore" : "unexpectedAfter";
                context.report({
                    node,
                    fix: safeFix(node, function (fixer) {
                        if (spaceRequired) {
                            if (after) return fixer.insertTextAfter(node, " ");
                            return fixer.insertTextBefore(node, " ");
                        }
                        return fixer.removeRange([leftToken.range[1], rightToken.range[0]]);
                    }),
                    messageId: (messageId) === "missingBefore" ? "missingBefore" : (messageId) === "missingAfter" ? "missingAfter" : (messageId) === "unexpectedBefore" ? "unexpectedBefore" : "unexpectedAfter"
                });
            }
        }
        function checkExpression(node) {
            if (!("delegate" in node && node.delegate)) return;
            const tokens = sourceCode.getFirstTokens(node, 3);
            const yieldToken = tokens[0];
            const starToken = tokens[1];
            const nextToken = tokens[2];
            checkSpacing("before", yieldToken, starToken);
            checkSpacing("after", starToken, nextToken);
        }
        return { YieldExpression: checkExpression };
    },
};
