import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "layout",
        description: 'Do not put spaces around attribute equals signs in Vue templates.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedSpaces": "Unexpected spaces found around equal signs." + " Correct this violation while preserving comments, binding scope, and behavior."
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
        return utils.defineTemplateBodyVisitor(context, { VAttribute(node) {
            if (!node.value) return;
            const range = [node.key.range[1], node.value.range[0]];
            const eqText = sourceCode.text.slice(range[0], range[1]);
            const expect = eqText.trim();
            if (eqText !== expect) context.report({
                node: node.key,
                loc: {
                    start: node.key.loc.end,
                    end: node.value.loc.start
                },
                fix: safeFix(node.key, (fixer) => fixer.replaceTextRange(range, expect)),
                messageId: "unexpectedSpaces"
            });
        } });
    },
};
