import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "layout",
        description: 'Use double quotes for attribute values in Vue templates.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "expected": "Expected to be enclosed by {{kind}}." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["double",{"avoidEscape":false}];
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

        const sourceCode = context.sourceCode;
        const shouldUseDoubleQuotes = ruleOptions[0] !== "single";
        const avoidEscape = ruleOptions[1] && ruleOptions[1].avoidEscape === true;
        const quoteChar = shouldUseDoubleQuotes ? "\"" : "'";
        const quoteName = shouldUseDoubleQuotes ? "double quotes" : "single quotes";
        let hasInvalidEOF;
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[value!=null]"(node) {
            if (hasInvalidEOF || utils.isVBindSameNameShorthand(node)) return;
            const text = sourceCode.getText(node.value);
            const firstChar = text[0];
            if (firstChar === quoteChar) return;
            const isQuoted = firstChar === "'" || firstChar === "\"";
            if (avoidEscape && isQuoted) {
                if (text.slice(1, -1).includes(quoteChar)) return;
            }
            context.report({
                node: node.value,
                loc: node.value.loc,
                data: { kind: quoteName },
                fix: safeFix(node.value, function (fixer) {
                    const contentText = isQuoted ? text.slice(1, -1) : text;
                    let shouldFixToDouble = shouldUseDoubleQuotes;
                    if (avoidEscape && !isQuoted && contentText.includes(quoteChar)) shouldFixToDouble = shouldUseDoubleQuotes ? contentText.includes("'") : !contentText.includes("\"");
                    const quotePattern = shouldFixToDouble ? /"/g : /'/g;
                    const quoteEscaped = shouldFixToDouble ? "&quot;" : "&apos;";
                    const fixQuoteChar = shouldFixToDouble ? "\"" : "'";
                    const replacement = fixQuoteChar + contentText.replace(quotePattern, () => quoteEscaped) + fixQuoteChar;
                    return fixer.replaceText(node.value, replacement);
                }),
                messageId: "expected"
            });
        } }, { Program(node) {
            hasInvalidEOF = utils.hasInvalidEOF(node);
        } });
    },
};
