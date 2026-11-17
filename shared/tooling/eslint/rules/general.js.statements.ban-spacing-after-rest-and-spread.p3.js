export default {
    meta: {
        type: "layout",
        description: "Ban spacing after rest and spread.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedWhitespace": "Unexpected whitespace after {{type}} operator." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedWhitespace": "Expected whitespace after {{type}} operator." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["never"];
        const [style] = ruleOptions;
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
        const alwaysSpace = style === "always";
        function checkWhiteSpace(node) {
            const operator = sourceCode.getFirstToken(node);
            const nextToken = sourceCode.getTokenAfter(operator);
            const hasWhitespace = sourceCode.isSpaceBetween(operator, nextToken);
            let type;
            switch (node.type) {
                case "SpreadElement":
                    type = "spread";
                    if (node.parent.type === "ObjectExpression") type += " property";
                    break;
                case "RestElement":
                    type = "rest";
                    if (node.parent.type === "ObjectPattern") type += " property";
                    break;
                default: return;
            }
            if (alwaysSpace && !hasWhitespace) context.report({
                node,
                loc: operator.loc,
                data: { type },
                fix: safeFix(node, function (fixer) {
                    return fixer.replaceTextRange([operator.range[1], nextToken.range[0]], " ");
                }),
                messageId: "expectedWhitespace"
            });
            else if (!alwaysSpace && hasWhitespace) context.report({
                node,
                loc: {
                    start: operator.loc.end,
                    end: nextToken.loc.start
                },
                data: { type },
                fix: safeFix(node, function (fixer) {
                    return fixer.removeRange([operator.range[1], nextToken.range[0]]);
                }),
                messageId: "unexpectedWhitespace"
            });
        }
        return {
            SpreadElement: checkWhiteSpace,
            RestElement: checkWhiteSpace
        };
    },
};
