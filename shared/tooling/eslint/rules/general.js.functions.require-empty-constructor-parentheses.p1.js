const { g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require empty constructor parentheses.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "missing": "Missing '()' invoking a constructor." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unnecessary": "Unnecessary '()' invoking a constructor with no arguments." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always"];
        const [style] = ruleOptions;
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

        const always = style !== "never";
        const sourceCode = context.sourceCode;
        return { NewExpression(node) {
            if (node.arguments.length !== 0) return;
            const lastToken = sourceCode.getLastToken(node);
            const hasLastParen = lastToken && (0, import_ast_utils.isClosingParenToken)(lastToken);
            const tokenBeforeLastToken = sourceCode.getTokenBefore(lastToken);
            const hasParens = hasLastParen && (0, import_ast_utils.isOpeningParenToken)(tokenBeforeLastToken) && node.callee.range[1] < node.range[1];
            if (always) {
                if (!hasParens) context.report({
                    node,
                    fix: safeFix(node, (fixer) => fixer.insertTextAfter(node, "()")),
                    messageId: "missing"
                });
            } else if (hasParens) context.report({
                node,
                fix: safeFix(node, (fixer) => [
                    fixer.remove(tokenBeforeLastToken),
                    fixer.remove(lastToken),
                    fixer.insertTextBefore(node, "("),
                    fixer.insertTextAfter(node, ")")
                ]),
                messageId: "unnecessary"
            });
        } };
    },
};
