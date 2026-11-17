import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Use @ shorthand for v-on directives with arguments.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "expectedShorthand": "Expected '@' instead of 'v-on:'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedLonghand": "Expected 'v-on:' instead of '@'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["shorthand"];
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

        const shouldPreferShorthand = ruleOptions[0] !== "longform";
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='on'][key.argument!=null]"(node) {
            if (node.key.name.rawName === "@" === shouldPreferShorthand) return;
            const pos = node.range[0];
            context.report({
                node,
                loc: node.loc,
                fix: safeFix(node, (fixer) => shouldPreferShorthand ? fixer.replaceTextRange([pos, pos + 5], "@") : fixer.replaceTextRange([pos, pos + 1], "v-on:")),
                messageId: shouldPreferShorthand ? "expectedShorthand" : "expectedLonghand"
            });
        } });
    },
};
