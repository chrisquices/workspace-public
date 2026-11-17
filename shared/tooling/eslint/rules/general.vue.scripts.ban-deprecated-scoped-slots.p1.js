import { resolveVueTemplateBinding } from '#eslint/helpers/resolve-vue-template-binding.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import require_index from "eslint-plugin-vue/dist/utils/index.js";
const utils = require_index.default;

export default {
    meta: {
        type: "problem",
        description: 'Use $slots instead of the deprecated $scopedSlots property.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "deprecated": "Use $slots instead of the deprecated $scopedSlots. Preserve slot behavior and avoid shadowing the replacement."
        },
    },
    create(context) {
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {
                let element = target;
                while (element && element.type !== "VElement") element = element.parent;
                if (element && resolveVueTemplateBinding("$slots", element, sourceForFixes)) return null;
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

        return utils.defineTemplateBodyVisitor(context, { VExpressionContainer(node) {
            for (const reference of node.references) {
                if (reference.variable != null) continue;
                if (reference.id.name === "$scopedSlots") context.report({
                    node: reference.id,
                    fix: safeFix(reference.id, function (fixer) {
                        return fixer.replaceText(reference.id, "$slots");
                    }),
                    messageId: "deprecated"
                });
            }
        } }, utils.defineVueVisitor(context, { MemberExpression(node) {
            if (node.property.type !== "Identifier" || node.property.name !== "$scopedSlots" || !utils.isThis(node.object, context)) return;
            context.report({
                node: node.property,
                fix: safeFix(node.property, function (fixer) {
                    return fixer.replaceText(node.property, "$slots");
                }),
                messageId: "deprecated"
            });
        } }));
    },
};
