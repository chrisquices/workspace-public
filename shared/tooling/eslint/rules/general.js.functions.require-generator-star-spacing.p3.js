const OVERRIDE_SCHEMA = { oneOf: [{
    type: "string",
    enum: [
        "before",
        "after",
        "both",
        "neither"
    ]
}, {
    type: "object",
    properties: {
        before: { type: "boolean" },
        after: { type: "boolean" }
    },
    additionalProperties: false
}] };

export default {
    meta: {
        type: "layout",
        description: "Require generator-star spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "missingBefore": "Missing space before *." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingAfter": "Missing space after *." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedBefore": "Unexpected space before *." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedAfter": "Unexpected space after *." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"before":false,"after":true}];
        const [options] = ruleOptions;
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

        const optionDefinitions = {
            before: {
                before: true,
                after: false
            },
            after: {
                before: false,
                after: true
            },
            both: {
                before: true,
                after: true
            },
            neither: {
                before: false,
                after: false
            }
        };
        function optionToDefinition(option, defaults) {
            if (!option) return defaults;
            return typeof option === "string" ? optionDefinitions[option] : Object.assign({}, defaults, option);
        }
        const modes = function() {
            const defaults = optionToDefinition(options, optionDefinitions.before);
            const { named, anonymous, method, shorthand } = options;
            return {
                named: optionToDefinition(named, defaults),
                anonymous: optionToDefinition(anonymous, defaults),
                method: optionToDefinition(method, defaults),
                shorthand: optionToDefinition(shorthand ?? method, defaults)
            };
        }();
        const sourceCode = context.sourceCode;
        function isStarToken(token) {
            return token.value === "*" && token.type === "Punctuator";
        }
        function getStarToken(node) {
            return sourceCode.getFirstToken("method" in node.parent && node.parent.method || node.parent.type === "MethodDefinition" ? node.parent : node, isStarToken);
        }
        function capitalize(str) {
            return str[0].toUpperCase() + str.slice(1);
        }
        function checkSpacing(kind, side, leftToken, rightToken) {
            if (!!(rightToken.range[0] - leftToken.range[1]) !== modes[kind][side]) {
                const after = leftToken.value === "*";
                const spaceRequired = modes[kind][side];
                const node = after ? leftToken : rightToken;
                const messageId = `${spaceRequired ? "missing" : "unexpected"}${capitalize(side)}`;
                context.report({
                    node,
                    fix: safeFix(node, function (fixer) {
                        if (spaceRequired) {
                            if (after) return fixer.insertTextAfter(node, " ");
                            return fixer.insertTextBefore(node, " ");
                        }
                        return fixer.removeRange([leftToken.range[1], rightToken.range[0]]);
                    }),
                    messageId: (messageId) === "missingBefore" ? "missingBefore" : (messageId) === "missingAfter" ? "missingAfter" : (messageId) === "unexpectedBefore" ? "unexpectedBefore" : "unexpectedAfter"
                });
            }
        }
        function checkFunction(node) {
            if (!node.generator) return;
            const starToken = getStarToken(node);
            const prevToken = sourceCode.getTokenBefore(starToken);
            const nextToken = sourceCode.getTokenAfter(starToken);
            let kind = "named";
            if (node.parent.type === "Property" && node.parent.method) kind = "shorthand";
            else if (node.parent.type === "MethodDefinition") kind = "method";
            else if (!node.id) kind = "anonymous";
            if (!((kind === "method" || kind === "shorthand") && starToken === sourceCode.getFirstToken(node.parent))) checkSpacing(kind, "before", prevToken, starToken);
            checkSpacing(kind, "after", starToken, nextToken);
        }
        return {
            FunctionDeclaration: checkFunction,
            FunctionExpression: checkFunction
        };
    },
};
