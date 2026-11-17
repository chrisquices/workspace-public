const { F: isDecimalIntegerNumericToken, g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require dots before property names.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "expectedDotAfterObject": "Expected dot to be on same line as object." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedDotBeforeProperty": "Expected dot to be on same line as property." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["property"];
        const [config] = ruleOptions;
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

        const onObject = config === "object";
        const sourceCode = context.sourceCode;
        function getProperty(node) {
            if (node.type === "TSImportType") return node.qualifier;
            if (node.type === "TSQualifiedName") return node.right;
            return node.property;
        }
        function checkDotLocation(node) {
            const property = getProperty(node);
            if (!property) return;
            const dotToken = sourceCode.getTokenBefore(property);
            if (!dotToken) return;
            if (onObject) {
                const tokenBeforeDot = sourceCode.getTokenBefore(dotToken);
                if (tokenBeforeDot && !(0, import_ast_utils.isTokenOnSameLine)(tokenBeforeDot, dotToken)) context.report({
                    node,
                    loc: dotToken.loc,
                    fix: safeFix(node, function* (fixer) {
                        if (dotToken.value.startsWith(".") && isDecimalIntegerNumericToken(tokenBeforeDot)) yield fixer.insertTextAfter(tokenBeforeDot, ` ${dotToken.value}`);
                        else yield fixer.insertTextAfter(tokenBeforeDot, dotToken.value);
                        yield fixer.remove(dotToken);
                    }),
                    messageId: "expectedDotAfterObject"
                });
            } else if (!(0, import_ast_utils.isTokenOnSameLine)(dotToken, property)) context.report({
                node,
                loc: dotToken.loc,
                fix: safeFix(node, function* (fixer) {
                    yield fixer.remove(dotToken);
                    yield fixer.insertTextBefore(property, dotToken.value);
                }),
                messageId: "expectedDotBeforeProperty"
            });
        }
        return {
            MemberExpression(node) {
                if (node.computed) return;
                checkDotLocation(node);
            },
            MetaProperty: checkDotLocation,
            JSXMemberExpression: checkDotLocation,
            TSQualifiedName: checkDotLocation,
            TSImportType: checkDotLocation
        };
    },
};
