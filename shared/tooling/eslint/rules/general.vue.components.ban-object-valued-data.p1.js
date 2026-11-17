import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function isOpenParen(token) {
    return token.type === "Punctuator" && token.value === "(";
}
function isCloseParen(token) {
    return token.type === "Punctuator" && token.value === ")";
}
function getFirstAndLastTokens(node, sourceCode) {
    let first = sourceCode.getFirstToken(node);
    let last = sourceCode.getLastToken(node);
    while (true) {
        const prev = sourceCode.getTokenBefore(first);
        const next = sourceCode.getTokenAfter(last);
        if (isOpenParen(prev) && isCloseParen(next)) {
            first = prev;
            last = next;
        } else return {
            first,
            last
        };
    }
}

export default {
    meta: {
        type: "problem",
        description: 'Define component data as a function returning an object.',
        includeInReadme: true,
        schema: [],
        fixable: "code",
        messages: {
            "objectDeclarationIsDeprecated": "Object declaration on 'data' property is deprecated. Using function declaration instead." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {
                if (target?.value?.type !== "ObjectExpression") return null;
                function inert(node) {
                    if (!node) return true;
                    if (node.type === "Literal" || node.type === "FunctionExpression") return true;
                    if (node.type === "ArrayExpression") return node.elements.every(inert);
                    if (node.type === "ObjectExpression") return node.properties.every(function (property) {
                        return property.type === "Property" && !property.computed && property.kind === "init" && inert(property.value);
                    });
                    return false;
                }
                if (!inert(target.value)) return null;
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

        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|\n|\r/u)?.[0] ?? "\n";
        return utils.executeOnVue(context, (obj) => {
            const invalidData = utils.findProperty(obj, "data", (p) => p.value.type !== "FunctionExpression" && p.value.type !== "ArrowFunctionExpression" && p.value.type !== "Identifier");
            if (invalidData) context.report({
                node: invalidData,
                fix: safeFix(invalidData, function (fixer) {
                    const tokens = getFirstAndLastTokens(invalidData.value, sourceCode);
                    return [fixer.insertTextBefore(tokens.first, `function() {${newline}return `), fixer.insertTextAfter(tokens.last, `;${newline}}`)];
                }),
                messageId: "objectDeclarationIsDeprecated"
            });
        });
    },
};
