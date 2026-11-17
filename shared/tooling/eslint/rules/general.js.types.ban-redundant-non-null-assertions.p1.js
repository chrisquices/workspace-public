export default {
    meta: {
        type: 'problem',
        description: 'Remove redundant non-null assertions before optional access or another assertion.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "noExtraNonNullAssertion": 'Forbidden extra non-null assertion.' + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
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

        function checkExtraNonNullAssertion(node) {
            context.report({
                node,
                fix: safeFix(node, function (fixer) {
                    return fixer.removeRange([node.range[1] - 1, node.range[1]]);
                }),
                messageId: 'noExtraNonNullAssertion'
            });
        }
        return {
            'CallExpression[optional = true] > TSNonNullExpression.callee': checkExtraNonNullAssertion,
            'MemberExpression[optional = true] > TSNonNullExpression.object': checkExtraNonNullAssertion,
            'TSNonNullExpression > TSNonNullExpression': checkExtraNonNullAssertion,
        };
    },
};
