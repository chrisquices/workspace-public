import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Close non-void Vue template elements unless they are self-closing.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "missingEndTag": "'<{{name}}>' should have end tag." + " Correct this violation while preserving comments, binding scope, and behavior."
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

        let hasInvalidEOF = false;
        return utils.defineTemplateBodyVisitor(context, { VElement(node) {
            if (hasInvalidEOF) return;
            const name = node.name;
            const isVoid = utils.isHtmlVoidElementName(name);
            const isSelfClosing = node.startTag.selfClosing;
            const hasEndTag = node.endTag != null;
            if (!isVoid && !hasEndTag && !isSelfClosing) context.report({
                node: node.startTag,
                loc: node.startTag.loc,
                data: { name },
                fix: safeFix(node.startTag, (fixer) => fixer.insertTextAfter(node, `</${node.rawName}>`)),
                messageId: "missingEndTag"
            });
        } }, { Program(node) {
            hasInvalidEOF = utils.hasInvalidEOF(node);
        } });
    },
};
