import require_index from "eslint-plugin-vue/dist/utils/index.js";
import slotConversion from "eslint-plugin-vue/dist/rules/syntaxes/utils/can-convert-to-v-slot.js";
const utils = require_index.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Use v-slot instead of deprecated slot-scope attributes.',
        includeInReadme: true,
        schema: [],
        fixable: "code",
        messages: {
            forbiddenSlotScopeAttribute: "Replace deprecated slot-scope with v-slot or #default on a slot template. Preserve destructuring, slot-local references, and slot ownership; migrate manually when a safe conversion cannot be determined."
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

        const sourceCode = context.sourceCode;
        const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore?.();
        const newline = sourceCode.text.match(/\r\n|\n|\r/u)?.[0] ?? "\n";

        return utils.defineTemplateBodyVisitor(context, {
            "VAttribute[directive=true][key.name.name='slot-scope']"(attribute) {
                context.report({
                    node: attribute.key,
                    messageId: "forbiddenSlotScopeAttribute",
                    fix: safeFix(attribute, function (fixer) {
                        const startTag = attribute.parent;
                        const element = startTag.parent;

                        if (!tokenStore || utils.hasInvalidEOF(sourceCode.ast)
                            || !slotConversion.default(element, sourceCode, tokenStore)) return null;

                        // Existing slot ownership and conditional/loop structure
                        // require a deliberate migration rather than a new wrapper.
                        if (utils.getAttribute(element, "slot") || utils.getDirective(element, "bind", "slot")
                            || utils.getDirective(element, "slot") || utils.getDirective(element.parent, "slot")
                            || ["if", "else-if", "else", "for"].some(function (name) {
                                return utils.getDirective(element, name);
                            })) return null;

                        const replacement = `#default${attribute.value ? `=${sourceCode.getText(attribute.value)}` : ""}`;

                        if (element.name === "template") return fixer.replaceText(attribute, replacement);

                        const previous = tokenStore.getTokenBefore(attribute);
                        if (!previous) return null;

                        return [
                            fixer.removeRange([previous.range[1], attribute.range[1]]),
                            fixer.insertTextBefore(element, `<template ${replacement}>${newline}`),
                            fixer.insertTextAfter(element, `${newline}</template>`),
                        ];
                    }),
                });
            },
        });
    },
};
