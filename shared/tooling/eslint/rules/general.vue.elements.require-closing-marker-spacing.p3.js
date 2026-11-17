import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function parseOptions(options, tokens) {
    const opts = Object.assign({
        startTag: "never",
        endTag: "never",
        selfClosingTag: "always"
    }, options);
    return Object.assign(opts, { detectType(node) {
        const openType = tokens.getFirstToken(node).type;
        const closeType = tokens.getLastToken(node).type;
        if (openType === "HTMLEndTagOpen" && closeType === "HTMLTagClose") return opts.endTag;
        if (openType === "HTMLTagOpen" && closeType === "HTMLTagClose") return opts.startTag;
        return openType === "HTMLTagOpen" && closeType === "HTMLSelfClosingTagClose" ? opts.selfClosingTag : null;
    } });
}

export default {
    meta: {
        type: "layout",
        description: 'Use no space before > and one space before /> on the same line.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "missing": "Expected a space before '{{bracket}}', but not found." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpected": "Expected no space before '{{bracket}}', but found." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"startTag":"never","endTag":"never","selfClosingTag":"always"}];
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
        const tokens = sourceCode.parserServices.getTemplateBodyTokenStore && sourceCode.parserServices.getTemplateBodyTokenStore();
        const options = parseOptions(ruleOptions[0], tokens);
        return utils.defineDocumentVisitor(context, { "VStartTag, VEndTag"(node) {
            const type = options.detectType(node);
            const lastToken = tokens.getLastToken(node);
            const prevToken = tokens.getLastToken(node, 1);
            if (type == null || prevToken == null || prevToken.loc.end.line !== lastToken.loc.start.line) return;
            const hasSpace = prevToken.range[1] !== lastToken.range[0];
            if (type === "always" && !hasSpace) context.report({
                node,
                loc: lastToken.loc,
                data: { bracket: sourceCode.getText(lastToken) },
                fix: safeFix(node, (fixer) => fixer.insertTextBefore(lastToken, " ")),
                messageId: "missing"
            });
            else if (type === "never" && hasSpace) context.report({
                node,
                loc: {
                    start: prevToken.loc.end,
                    end: lastToken.loc.end
                },
                data: { bracket: sourceCode.getText(lastToken) },
                fix: safeFix(node, (fixer) => fixer.removeRange([prevToken.range[1], lastToken.range[0]])),
                messageId: "unexpected"
            });
        } });
    },
};
