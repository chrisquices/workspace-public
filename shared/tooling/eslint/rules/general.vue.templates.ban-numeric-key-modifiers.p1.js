import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_keycode_to_key from "eslint-plugin-vue/dist/utils/keycode-to-key.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use key names instead of deprecated numeric keyboard modifiers.',
        includeInReadme: true,
        schema: [],
        fixable: "code",
        messages: {
            "numberModifierIsDeprecated": "'KeyboardEvent.keyCode' modifier on 'v-on' directive is deprecated. Using 'KeyboardEvent.key' instead." + " Correct this violation while preserving comments, binding scope, and behavior."
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

        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='on'] > VDirectiveKey"(node) {
            const modifier = node.modifiers.find((mod) => Number.isSafeInteger(Number(mod.name)));
            if (!modifier) return;
            const keyCodes = Number(modifier.name);
            if (keyCodes > 9 || keyCodes < 0) context.report({
                node: modifier,
                fix: safeFix(modifier, function (fixer) {
                    const key = require_keycode_to_key.default[keyCodes];
                    return key ? fixer.replaceText(modifier, key) : null;
                }),
                messageId: "numberModifierIsDeprecated"
            });
        } });
    },
};
