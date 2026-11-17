import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
import require_regexp from "eslint-plugin-vue/dist/utils/regexp.js";
const utils = require_index.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Use kebab-case for Vue component event listeners.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "mustBeHyphenated": "v-on event '{{text}}' must be hyphenated." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "cannotBeHyphenated": "v-on event '{{text}}' can't be hyphenated." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always",{"autofix":true,"ignore":[],"ignoreTags":[]}];
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
        const option = ruleOptions[0];
        const optionsPayload = ruleOptions[1];
        const shouldUseHyphenated = option !== "never";
        const ignoredAttributes = optionsPayload && optionsPayload.ignore || [];
        const isIgnoredTag = require_regexp.toRegExpGroupMatcher(optionsPayload?.ignoreTags);
        const shouldAutofix = Boolean(optionsPayload && optionsPayload.autofix);
        const caseConverter = require_casing.getConverter(shouldUseHyphenated ? "kebab-case" : "camelCase");
        function reportIssue(node, argument, name) {
            const text = sourceCode.getText(node.key);
            context.report({
                node: node.key,
                loc: node.loc,
                data: { text },
                fix: safeFix(node.key, shouldAutofix && !name.includes("_") ? (fixer) => fixer.replaceText(argument, caseConverter(name)) : null),
                messageId: shouldUseHyphenated ? "mustBeHyphenated" : "cannotBeHyphenated"
            });
        }
        function isIgnoredAttribute(value) {
            if (ignoredAttributes.some((attr) => value.includes(attr))) return true;
            return shouldUseHyphenated ? value.toLowerCase() === value : !/-/.test(value);
        }
        return utils.defineTemplateBodyVisitor(context, { "VAttribute[directive=true][key.name.name='on']"(node) {
            const element = node.parent.parent;
            if (!utils.isCustomComponent(element) || isIgnoredTag(element.rawName) || !node.key.argument || node.key.argument.type !== "VIdentifier") return;
            const name = node.key.argument.rawName;
            if (!name || isIgnoredAttribute(name)) return;
            reportIssue(node, node.key.argument, name);
        } });
    },
};
