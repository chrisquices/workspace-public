const { w: canTokensBeAdjacent } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require digits around decimal points.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "leading": "A leading decimal point can be confused with a dot." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "trailing": "A trailing decimal point can be confused with a dot." + " Correct this violation while preserving comments, binding scope, and behavior."
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

        const sourceCode = context.sourceCode;
        return { Literal(node) {
            if (typeof node.value === "number") {
                if (node.raw.startsWith(".")) context.report({
                    node,
                    fix: safeFix(node, function (fixer) {
                        const tokenBefore = sourceCode.getTokenBefore(node);
                        const needsSpaceBefore = tokenBefore && tokenBefore.range[1] === node.range[0] && !canTokensBeAdjacent(tokenBefore, `0${node.raw}`);
                        return fixer.insertTextBefore(node, needsSpaceBefore ? " 0" : "0");
                    }),
                    messageId: "leading"
                });
                if (node.raw.indexOf(".") === node.raw.length - 1) context.report({
                    node,
                    fix: safeFix(node, (fixer) => fixer.insertTextAfter(node, "0")),
                    messageId: "trailing"
                });
            }
        } };
    },
};
