const { S: STATEMENT_LIST_PARENTS, d: safeReplaceTextBetween, g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require same-line block continuations.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "nextLineOpen": "Opening curly brace does not appear on the same line as controlling statement." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "sameLineOpen": "Opening curly brace appears on the same line as controlling statement." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "blockSameLine": "Statement inside of curly braces should be on next line." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "nextLineClose": "Closing curly brace does not appear on the same line as the subsequent block." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "singleLineClose": "Closing curly brace should be on the same line as opening curly brace or on the line after the previous block." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "sameLineClose": "Closing curly brace appears on the same line as the subsequent block." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["1tbs",{"allowSingleLine":true}];
        const [style, options] = ruleOptions;
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
        const { allowSingleLine } = options;
        const isAllmanStyle = style === "allman";
        function validateCurlyPair(openingCurlyToken, closingCurlyToken) {
            const tokenBeforeOpeningCurly = sourceCode.getTokenBefore(openingCurlyToken);
            const tokenBeforeClosingCurly = sourceCode.getTokenBefore(closingCurlyToken);
            const tokenAfterOpeningCurly = sourceCode.getTokenAfter(openingCurlyToken);
            const singleLineException = allowSingleLine && (0, import_ast_utils.isTokenOnSameLine)(openingCurlyToken, closingCurlyToken);
            if (!isAllmanStyle && !(0, import_ast_utils.isTokenOnSameLine)(tokenBeforeOpeningCurly, openingCurlyToken)) context.report({
                node: openingCurlyToken,
                fix: safeFix(openingCurlyToken, safeReplaceTextBetween(sourceCode, tokenBeforeOpeningCurly, openingCurlyToken, " ")),
                messageId: "nextLineOpen"
            });
            if (isAllmanStyle && (0, import_ast_utils.isTokenOnSameLine)(tokenBeforeOpeningCurly, openingCurlyToken) && !singleLineException) context.report({
                node: openingCurlyToken,
                fix: safeFix(openingCurlyToken, (fixer) => fixer.insertTextBefore(openingCurlyToken, "\n")),
                messageId: "sameLineOpen"
            });
            if ((0, import_ast_utils.isTokenOnSameLine)(openingCurlyToken, tokenAfterOpeningCurly) && tokenAfterOpeningCurly !== closingCurlyToken && !singleLineException) context.report({
                node: openingCurlyToken,
                fix: safeFix(openingCurlyToken, (fixer) => fixer.insertTextAfter(openingCurlyToken, "\n")),
                messageId: "blockSameLine"
            });
            if ((0, import_ast_utils.isTokenOnSameLine)(tokenBeforeClosingCurly, closingCurlyToken) && tokenBeforeClosingCurly !== openingCurlyToken && !singleLineException) context.report({
                node: closingCurlyToken,
                fix: safeFix(closingCurlyToken, (fixer) => fixer.insertTextBefore(closingCurlyToken, "\n")),
                messageId: "singleLineClose"
            });
        }
        function validateCurlyBeforeKeyword(curlyToken) {
            const keywordToken = sourceCode.getTokenAfter(curlyToken);
            if (style === "1tbs" && !(0, import_ast_utils.isTokenOnSameLine)(curlyToken, keywordToken)) context.report({
                node: curlyToken,
                fix: safeFix(curlyToken, safeReplaceTextBetween(sourceCode, curlyToken, keywordToken, " ")),
                messageId: "nextLineClose"
            });
            if (style !== "1tbs" && (0, import_ast_utils.isTokenOnSameLine)(curlyToken, keywordToken)) context.report({
                node: curlyToken,
                fix: safeFix(curlyToken, (fixer) => fixer.insertTextAfter(curlyToken, "\n")),
                messageId: "sameLineClose"
            });
        }
        return {
            BlockStatement(node) {
                if (!STATEMENT_LIST_PARENTS.has(node.parent.type)) validateCurlyPair(sourceCode.getFirstToken(node), sourceCode.getLastToken(node));
            },
            StaticBlock(node) {
                validateCurlyPair(sourceCode.getFirstToken(node, { skip: 1 }), sourceCode.getLastToken(node));
            },
            ClassBody(node) {
                validateCurlyPair(sourceCode.getFirstToken(node), sourceCode.getLastToken(node));
            },
            SwitchStatement(node) {
                const closingCurly = sourceCode.getLastToken(node);
                validateCurlyPair(sourceCode.getTokenBefore(node.cases.length ? node.cases[0] : closingCurly), closingCurly);
            },
            IfStatement(node) {
                if (node.consequent.type === "BlockStatement" && node.alternate) validateCurlyBeforeKeyword(sourceCode.getLastToken(node.consequent));
            },
            TryStatement(node) {
                validateCurlyBeforeKeyword(sourceCode.getLastToken(node.block));
                if (node.handler && node.finalizer) validateCurlyBeforeKeyword(sourceCode.getLastToken(node.handler.body));
            },
            TSModuleBlock(node) {
                validateCurlyPair(sourceCode.getFirstToken(node), sourceCode.getLastToken(node));
            }
        };
    },
};
