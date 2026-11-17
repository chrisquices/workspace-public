const { g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Ban inner computed-property spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedSpaceBefore": "There should be no space before '{{tokenValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpaceAfter": "There should be no space after '{{tokenValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingSpaceBefore": "A space is required before '{{tokenValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingSpaceAfter": "A space is required after '{{tokenValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["never",{"enforceForClassMembers":true}];
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
        const propertyNameMustBeSpaced = style === "always";
        const { enforceForClassMembers } = options;
        function reportNoBeginningSpace(node, token, tokenAfter) {
            context.report({
                node,
                loc: {
                    start: token.loc.end,
                    end: tokenAfter.loc.start
                },
                data: { tokenValue: token.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.removeRange([token.range[1], tokenAfter.range[0]]);
                }),
                messageId: "unexpectedSpaceAfter"
            });
        }
        function reportNoEndingSpace(node, token, tokenBefore) {
            context.report({
                node,
                loc: {
                    start: tokenBefore.loc.end,
                    end: token.loc.start
                },
                data: { tokenValue: token.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.removeRange([tokenBefore.range[1], token.range[0]]);
                }),
                messageId: "unexpectedSpaceBefore"
            });
        }
        function reportRequiredBeginningSpace(node, token) {
            context.report({
                node,
                loc: token.loc,
                data: { tokenValue: token.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.insertTextAfter(token, " ");
                }),
                messageId: "missingSpaceAfter"
            });
        }
        function reportRequiredEndingSpace(node, token) {
            context.report({
                node,
                loc: token.loc,
                data: { tokenValue: token.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.insertTextBefore(token, " ");
                }),
                messageId: "missingSpaceBefore"
            });
        }
        function checkSpacing(propertyName) {
            return function(node) {
                if (node.type !== "TSIndexedAccessType" && !node.computed) return;
                const property = node[propertyName];
                const before = sourceCode.getTokenBefore(property, import_ast_utils.isOpeningBracketToken);
                const first = sourceCode.getTokenAfter(before, { includeComments: true });
                const after = sourceCode.getTokenAfter(property, import_ast_utils.isClosingBracketToken);
                const last = sourceCode.getTokenBefore(after, { includeComments: true });
                if ((0, import_ast_utils.isTokenOnSameLine)(before, first)) {
                    if (propertyNameMustBeSpaced) {
                        if (!sourceCode.isSpaceBetween(before, first) && (0, import_ast_utils.isTokenOnSameLine)(before, first)) reportRequiredBeginningSpace(node, before);
                    } else if (sourceCode.isSpaceBetween(before, first)) reportNoBeginningSpace(node, before, first);
                }
                if ((0, import_ast_utils.isTokenOnSameLine)(last, after)) {
                    if (propertyNameMustBeSpaced) {
                        if (!sourceCode.isSpaceBetween(last, after) && (0, import_ast_utils.isTokenOnSameLine)(last, after)) reportRequiredEndingSpace(node, after);
                    } else if (sourceCode.isSpaceBetween(last, after)) reportNoEndingSpace(node, after, last);
                }
            };
        }
        const listeners = {
            Property: checkSpacing("key"),
            MemberExpression: checkSpacing("property"),
            TSIndexedAccessType: checkSpacing("indexType")
        };
        if (enforceForClassMembers) {
            listeners.MethodDefinition = checkSpacing("key");
            listeners.PropertyDefinition = checkSpacing("key");
            listeners.AccessorProperty = checkSpacing("key");
        }
        return listeners;
    },
};
