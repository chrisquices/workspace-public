const { g: import_ast_utils, h: AST_TOKEN_TYPES } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require inner block spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "missing": "Requires a space {{location}} '{{token}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "extra": "Unexpected space(s) {{location}} '{{token}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always"];
        const [whenToApplyOption] = ruleOptions;
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
        const always = whenToApplyOption !== "never";
        const messageId = always ? "missing" : "extra";
        function getOpenBrace(node) {
            return sourceCode.getFirstToken(node, { filter: (token) => (0, import_ast_utils.isOpeningBraceToken)(token) });
        }
        function isValid(left, right) {
            return !(0, import_ast_utils.isTokenOnSameLine)(left, right) || sourceCode.isSpaceBetween(left, right) === always;
        }
        function checkSpacingInsideBraces(node) {
            const openBrace = getOpenBrace(node);
            const closeBrace = sourceCode.getLastToken(node);
            const firstToken = sourceCode.getTokenAfter(openBrace, { includeComments: true });
            const lastToken = sourceCode.getTokenBefore(closeBrace, { includeComments: true });
            if (!(0, import_ast_utils.isOpeningBraceToken)(openBrace) || !(0, import_ast_utils.isClosingBraceToken)(closeBrace) || firstToken === closeBrace) return;
            if (!always && firstToken.type === AST_TOKEN_TYPES.Line) return;
            if (!isValid(openBrace, firstToken)) {
                let loc = openBrace.loc;
                if (messageId === "extra") loc = {
                    start: openBrace.loc.end,
                    end: firstToken.loc.start
                };
                context.report({
                    node,
                    loc,
                    data: {
                        location: "after",
                        token: openBrace.value
                    },
                    fix: safeFix(node, function (fixer) {
                        if (always) return fixer.insertTextBefore(firstToken, " ");
                        return fixer.removeRange([openBrace.range[1], firstToken.range[0]]);
                    }),
                    messageId: (messageId) === "missing" ? "missing" : "extra"
                });
            }
            if (!isValid(lastToken, closeBrace)) {
                let loc = closeBrace.loc;
                if (messageId === "extra") loc = {
                    start: lastToken.loc.end,
                    end: closeBrace.loc.start
                };
                context.report({
                    node,
                    loc,
                    data: {
                        location: "before",
                        token: closeBrace.value
                    },
                    fix: safeFix(node, function (fixer) {
                        if (always) return fixer.insertTextAfter(lastToken, " ");
                        return fixer.removeRange([lastToken.range[1], closeBrace.range[0]]);
                    }),
                    messageId: (messageId) === "missing" ? "missing" : "extra"
                });
            }
        }
        return {
            BlockStatement: checkSpacingInsideBraces,
            StaticBlock: checkSpacingInsideBraces,
            SwitchStatement: checkSpacingInsideBraces
        };
    },
};
