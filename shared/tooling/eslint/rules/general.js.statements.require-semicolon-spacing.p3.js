const { g: import_ast_utils, m: AST_NODE_TYPES } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require semicolon spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedWhitespaceBefore": "Unexpected whitespace before semicolon." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedWhitespaceAfter": "Unexpected whitespace after semicolon." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingWhitespaceBefore": "Missing whitespace before semicolon." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingWhitespaceAfter": "Missing whitespace after semicolon." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"before":false,"after":true}];
        const [config] = ruleOptions;
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

        const { before: requireSpaceBefore, after: requireSpaceAfter } = config;
        const sourceCode = context.sourceCode;
        function hasLeadingSpace(token) {
            const tokenBefore = sourceCode.getTokenBefore(token);
            return tokenBefore && (0, import_ast_utils.isTokenOnSameLine)(tokenBefore, token) && sourceCode.isSpaceBetween(tokenBefore, token);
        }
        function hasTrailingSpace(token) {
            const tokenAfter = sourceCode.getTokenAfter(token);
            return tokenAfter && (0, import_ast_utils.isTokenOnSameLine)(token, tokenAfter) && sourceCode.isSpaceBetween(token, tokenAfter);
        }
        function isLastTokenInCurrentLine(token) {
            const tokenAfter = sourceCode.getTokenAfter(token);
            return !(tokenAfter && (0, import_ast_utils.isTokenOnSameLine)(token, tokenAfter));
        }
        function isFirstTokenInCurrentLine(token) {
            const tokenBefore = sourceCode.getTokenBefore(token);
            return !(tokenBefore && (0, import_ast_utils.isTokenOnSameLine)(token, tokenBefore));
        }
        function isBeforeClosingParen(token) {
            const nextToken = sourceCode.getTokenAfter(token);
            return nextToken && (0, import_ast_utils.isClosingBraceToken)(nextToken) || (0, import_ast_utils.isClosingParenToken)(nextToken);
        }
        function checkSemicolonSpacing(token, node) {
            if ((0, import_ast_utils.isSemicolonToken)(token)) {
                if (hasLeadingSpace(token)) {
                    if (!requireSpaceBefore) {
                        const tokenBefore = sourceCode.getTokenBefore(token);
                        const loc = {
                            start: tokenBefore.loc.end,
                            end: token.loc.start
                        };
                        context.report({
                            node,
                            loc,
                            fix: safeFix(node, function (fixer) {
                                return fixer.removeRange([tokenBefore.range[1], token.range[0]]);
                            }),
                            messageId: "unexpectedWhitespaceBefore"
                        });
                    }
                } else if (requireSpaceBefore) {
                    const loc = token.loc;
                    context.report({
                        node,
                        loc,
                        fix: safeFix(node, function (fixer) {
                            return fixer.insertTextBefore(token, " ");
                        }),
                        messageId: "missingWhitespaceBefore"
                    });
                }
                if (!isFirstTokenInCurrentLine(token) && !isLastTokenInCurrentLine(token) && !isBeforeClosingParen(token)) {
                    if (hasTrailingSpace(token)) {
                        if (!requireSpaceAfter) {
                            const tokenAfter = sourceCode.getTokenAfter(token);
                            const loc = {
                                start: token.loc.end,
                                end: tokenAfter.loc.start
                            };
                            context.report({
                                node,
                                loc,
                                fix: safeFix(node, function (fixer) {
                                    return fixer.removeRange([token.range[1], tokenAfter.range[0]]);
                                }),
                                messageId: "unexpectedWhitespaceAfter"
                            });
                        }
                    } else if (requireSpaceAfter) {
                        const loc = token.loc;
                        context.report({
                            node,
                            loc,
                            fix: safeFix(node, function (fixer) {
                                return fixer.insertTextAfter(token, " ");
                            }),
                            messageId: "missingWhitespaceAfter"
                        });
                    }
                }
            }
        }
        function checkNode(node) {
            checkSemicolonSpacing(sourceCode.getLastToken(node), node);
        }
        return {
            VariableDeclaration: checkNode,
            ExpressionStatement: checkNode,
            BreakStatement: checkNode,
            ContinueStatement: checkNode,
            DebuggerStatement: checkNode,
            DoWhileStatement: checkNode,
            ReturnStatement: checkNode,
            ThrowStatement: checkNode,
            ImportDeclaration: checkNode,
            ExportNamedDeclaration: checkNode,
            ExportAllDeclaration: checkNode,
            ExportDefaultDeclaration: checkNode,
            ForStatement(node) {
                if (node.init) checkSemicolonSpacing(sourceCode.getTokenAfter(node.init), node);
                if (node.test) checkSemicolonSpacing(sourceCode.getTokenAfter(node.test), node);
            },
            PropertyDefinition: checkNode,
            AccessorProperty: checkNode,
            TSDeclareFunction: checkNode,
            TSTypeAliasDeclaration: checkNode,
            TSTypeAnnotation(node) {
                const excludeNodeTypes = new Set([AST_NODE_TYPES.TSDeclareFunction]);
                if (node.parent && !excludeNodeTypes.has(node.parent.type)) checkNode(node.parent);
            }
        };
    },
};
