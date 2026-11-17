const { g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Ban inner parenthesis spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "missingOpeningSpace": "There must be a space after this paren." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingClosingSpace": "There must be a space before this paren." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "rejectedOpeningSpace": "There should be no space after this paren." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "rejectedClosingSpace": "There should be no space before this paren." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["never"];
        const [style, { exceptions: exceptionsArrayOptions = [] } = {}] = ruleOptions;
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

        const ALWAYS = style === "always";
        const options = {
            braceException: false,
            bracketException: false,
            parenException: false,
            empty: false
        };
        let exceptions = {
            openers: [],
            closers: []
        };
        if (exceptionsArrayOptions.length) {
            options.braceException = exceptionsArrayOptions.includes("{}");
            options.bracketException = exceptionsArrayOptions.includes("[]");
            options.parenException = exceptionsArrayOptions.includes("()");
            options.empty = exceptionsArrayOptions.includes("empty");
        }
        function getExceptions() {
            const openers = [];
            const closers = [];
            if (options.braceException) {
                openers.push("{");
                closers.push("}");
            }
            if (options.bracketException) {
                openers.push("[");
                closers.push("]");
            }
            if (options.parenException) {
                openers.push("(");
                closers.push(")");
            }
            if (options.empty) {
                openers.push(")");
                closers.push("(");
            }
            return {
                openers,
                closers
            };
        }
        const sourceCode = context.sourceCode;
        function isOpenerException(token) {
            return exceptions.openers.includes(token.value);
        }
        function isCloserException(token) {
            return exceptions.closers.includes(token.value);
        }
        function openerMissingSpace(openingParenToken, tokenAfterOpeningParen) {
            if (sourceCode.isSpaceBetween(openingParenToken, tokenAfterOpeningParen)) return false;
            if (!options.empty && (0, import_ast_utils.isClosingParenToken)(tokenAfterOpeningParen)) return false;
            if (ALWAYS) return !isOpenerException(tokenAfterOpeningParen);
            return isOpenerException(tokenAfterOpeningParen);
        }
        function openerRejectsSpace(openingParenToken, tokenAfterOpeningParen) {
            if (!(0, import_ast_utils.isTokenOnSameLine)(openingParenToken, tokenAfterOpeningParen)) return false;
            if (tokenAfterOpeningParen.type === "Line") return false;
            if (!sourceCode.isSpaceBetween(openingParenToken, tokenAfterOpeningParen)) return false;
            if (ALWAYS) return isOpenerException(tokenAfterOpeningParen);
            return !isOpenerException(tokenAfterOpeningParen);
        }
        function closerMissingSpace(tokenBeforeClosingParen, closingParenToken) {
            if (sourceCode.isSpaceBetween(tokenBeforeClosingParen, closingParenToken)) return false;
            if (!options.empty && (0, import_ast_utils.isOpeningParenToken)(tokenBeforeClosingParen)) return false;
            if (ALWAYS) return !isCloserException(tokenBeforeClosingParen);
            return isCloserException(tokenBeforeClosingParen);
        }
        function closerRejectsSpace(tokenBeforeClosingParen, closingParenToken) {
            if (!(0, import_ast_utils.isTokenOnSameLine)(tokenBeforeClosingParen, closingParenToken)) return false;
            if (!sourceCode.isSpaceBetween(tokenBeforeClosingParen, closingParenToken)) return false;
            if (ALWAYS) return isCloserException(tokenBeforeClosingParen);
            return !isCloserException(tokenBeforeClosingParen);
        }
        return { Program: function checkParenSpaces(node) {
            exceptions = getExceptions();
            const tokens = sourceCode.tokensAndComments;
            tokens.forEach((token, i) => {
                const prevToken = tokens[i - 1];
                const nextToken = tokens[i + 1];
                if (!(0, import_ast_utils.isOpeningParenToken)(token) && !(0, import_ast_utils.isClosingParenToken)(token)) return;
                if (token.value === "(" && openerMissingSpace(token, nextToken)) context.report({
                    node,
                    loc: token.loc,
                    fix: safeFix(node, function (fixer) {
                        return fixer.insertTextAfter(token, " ");
                    }),
                    messageId: "missingOpeningSpace"
                });
                if (token.value === "(" && openerRejectsSpace(token, nextToken)) context.report({
                    node,
                    loc: {
                        start: token.loc.end,
                        end: nextToken.loc.start
                    },
                    fix: safeFix(node, function (fixer) {
                        return fixer.removeRange([token.range[1], nextToken.range[0]]);
                    }),
                    messageId: "rejectedOpeningSpace"
                });
                if (token.value === ")" && closerMissingSpace(prevToken, token)) context.report({
                    node,
                    loc: token.loc,
                    fix: safeFix(node, function (fixer) {
                        return fixer.insertTextBefore(token, " ");
                    }),
                    messageId: "missingClosingSpace"
                });
                if (token.value === ")" && closerRejectsSpace(prevToken, token)) context.report({
                    node,
                    loc: {
                        start: prevToken.loc.end,
                        end: token.loc.start
                    },
                    fix: safeFix(node, function (fixer) {
                        return fixer.removeRange([prevToken.range[1], token.range[0]]);
                    }),
                    messageId: "rejectedClosingSpace"
                });
            });
        } };
    },
};
