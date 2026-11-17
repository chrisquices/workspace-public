import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;
function fix(fixer, property, newName) {
    if (property.computed) return property.key.type === "Literal" || property.key.type === "TemplateLiteral" ? fixer.replaceTextRange([property.key.range[0] + 1, property.key.range[1] - 1], newName) : null;
    return property.shorthand ? fixer.insertTextBefore(property.key, `${newName}:`) : fixer.replaceText(property.key, newName);
}

export default {
    meta: {
        type: "problem",
        description: 'Use beforeUnmount and unmounted instead of deprecated destroy lifecycle hooks.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "deprecatedDestroyed": "The `destroyed` lifecycle hook is deprecated. Use `unmounted` instead." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "deprecatedBeforeDestroy": "The `beforeDestroy` lifecycle hook is deprecated. Use `beforeUnmount` instead." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {
                const property = target?.parent;
                const nextName = getStaticPropertyName(property) === "destroyed" ? "unmounted" : "beforeUnmount";
                if (property?.parent?.type !== "ObjectExpression" || property.parent.properties.some(function (other) {
                    return other !== property && (other.type === "SpreadElement" || getStaticPropertyName(other) === nextName);
                })) return null;
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

        return utils.executeOnVue(context, (obj) => {
            const destroyed = utils.findProperty(obj, "destroyed");
            if (destroyed) context.report({
                node: destroyed.key,
                fix: safeFix(destroyed.key, function (fixer) {
                    return fix(fixer, destroyed, "unmounted");
                }),
                messageId: "deprecatedDestroyed"
            });
            const beforeDestroy = utils.findProperty(obj, "beforeDestroy");
            if (beforeDestroy) context.report({
                node: beforeDestroy.key,
                fix: safeFix(beforeDestroy.key, function (fixer) {
                    return fix(fixer, beforeDestroy, "beforeUnmount");
                }),
                messageId: "deprecatedBeforeDestroy"
            });
        });
    },
};
