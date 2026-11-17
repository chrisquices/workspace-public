const { P: isDecimalInteger, d: safeReplaceTextBetween, g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Ban property-access spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedWhitespace": "Unexpected whitespace before property {{propName}}." + " Correct this violation while preserving comments, binding scope, and behavior."
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
        function reportError(descriptor) {
            const { node, leftToken, rightToken, propName, replacementText = "", preventAutoFix } = descriptor;
            context.report({
                node,
                data: { propName },
                fix: safeFix(node, preventAutoFix?.() ? null : safeReplaceTextBetween(sourceCode, leftToken, rightToken, replacementText)),
                messageId: "unexpectedWhitespace"
            });
        }
        return {
            MemberExpression(node) {
                if (!(0, import_ast_utils.isTokenOnSameLine)(node.object, node.property)) return;
                let rightToken;
                let leftToken;
                if (node.computed) {
                    rightToken = sourceCode.getTokenBefore(node.property, import_ast_utils.isOpeningBracketToken);
                    leftToken = sourceCode.getTokenBefore(rightToken, node.optional ? 1 : 0);
                } else {
                    rightToken = sourceCode.getFirstToken(node.property);
                    leftToken = sourceCode.getTokenBefore(rightToken, 1);
                }
                if (!sourceCode.isSpaceBetween(leftToken, rightToken)) return;
                let replacementText = "";
                if (node.optional) replacementText = "?.";
                else if (!node.computed) replacementText = ".";
                reportError({
                    node,
                    leftToken,
                    rightToken,
                    propName: sourceCode.getText(node.property),
                    replacementText,
                    preventAutoFix: () => !node.computed && !node.optional && isDecimalInteger(node.object)
                });
            },
            TSIndexedAccessType(node) {
                const rightToken = sourceCode.getTokenBefore(node.indexType, import_ast_utils.isOpeningBracketToken);
                const leftToken = sourceCode.getTokenBefore(rightToken);
                if (!sourceCode.isSpaceBetween(leftToken, rightToken)) return;
                reportError({
                    node,
                    leftToken,
                    rightToken,
                    propName: sourceCode.getText(node.indexType)
                });
            },
            TSQualifiedName(node) {
                const leftToken = node.left;
                const rightToken = node.right;
                if (!sourceCode.isSpaceBetween(leftToken, rightToken)) return;
                reportError({
                    node,
                    leftToken,
                    rightToken,
                    replacementText: ".",
                    propName: sourceCode.getText(node.right)
                });
            },
            TSImportType(node) {
                if (!node.qualifier) return;
                const rightToken = node.qualifier;
                const leftToken = sourceCode.getTokenBefore(rightToken, 1);
                if (!sourceCode.isSpaceBetween(leftToken, rightToken)) return;
                reportError({
                    node,
                    leftToken,
                    rightToken,
                    replacementText: ".",
                    propName: sourceCode.getText(node.qualifier)
                });
            }
        };
    },
};
