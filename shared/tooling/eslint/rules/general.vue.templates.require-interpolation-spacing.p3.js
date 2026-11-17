import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "layout",
        description: 'Put spaces inside Vue interpolation delimiters.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "expectedSpaceAfter": "Expected 1 space after '{{', but not found." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedSpaceBefore": "Expected 1 space before '}}', but not found." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpaceAfter": "Expected no space after '{{', but found." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpaceBefore": "Expected no space before '}}', but found." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always"];
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

        const options = ruleOptions[0] || "always";
        const sourceCode = context.sourceCode;
        const template = sourceCode.parserServices.getTemplateBodyTokenStore && sourceCode.parserServices.getTemplateBodyTokenStore();
        return utils.defineTemplateBodyVisitor(context, { "VExpressionContainer[expression!=null]"(node) {
            const openBrace = template.getFirstToken(node);
            const closeBrace = template.getLastToken(node);
            if (!openBrace || !closeBrace || openBrace.type !== "VExpressionStart" || closeBrace.type !== "VExpressionEnd") return;
            const firstToken = template.getTokenAfter(openBrace, { includeComments: true });
            const lastToken = template.getTokenBefore(closeBrace, { includeComments: true });
            if (options === "always") {
                if (openBrace.range[1] === firstToken.range[0]) context.report({
                    node: openBrace,
                    fix: safeFix(openBrace, (fixer) => fixer.insertTextAfter(openBrace, " ")),
                    messageId: "expectedSpaceAfter"
                });
                if (closeBrace.range[0] === lastToken.range[1]) context.report({
                    node: closeBrace,
                    fix: safeFix(closeBrace, (fixer) => fixer.insertTextBefore(closeBrace, " ")),
                    messageId: "expectedSpaceBefore"
                });
            } else {
                if (openBrace.range[1] !== firstToken.range[0]) context.report({
                    loc: {
                        start: openBrace.loc.start,
                        end: firstToken.loc.start
                    },
                    fix: safeFix(null, (fixer) => fixer.removeRange([openBrace.range[1], firstToken.range[0]])),
                    messageId: "unexpectedSpaceAfter"
                });
                if (closeBrace.range[0] !== lastToken.range[1]) context.report({
                    loc: {
                        start: lastToken.loc.end,
                        end: closeBrace.loc.end
                    },
                    fix: safeFix(null, (fixer) => fixer.removeRange([lastToken.range[1], closeBrace.range[0]])),
                    messageId: "unexpectedSpaceBefore"
                });
            }
        } });
    },
};
