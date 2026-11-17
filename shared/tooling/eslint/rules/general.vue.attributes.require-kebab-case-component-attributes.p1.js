import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_casing from "eslint-plugin-vue/dist/utils/casing.js";
import require_regexp from "eslint-plugin-vue/dist/utils/regexp.js";
import require_svg_attributes_weird_case from "eslint-plugin-vue/dist/utils/svg-attributes-weird-case.js";
const utils = require_index.default;
function getAttributeName(node) {
    if (!node.directive) return node.key.rawName;
    return (node.key.name.name === "bind" || node.key.name.name === "model") && node.key.argument && node.key.argument.type === "VIdentifier" ? node.key.argument.rawName : null;
}

export default {
    meta: {
        type: "suggestion",
        description: 'Use kebab-case for Vue component attributes.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "mustBeHyphenated": "Attribute '{{text}}' must be hyphenated." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "cannotBeHyphenated": "Attribute '{{text}}' can't be hyphenated." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always",{"ignore":[],"ignoreTags":[]}];
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
        const isIgnoredTagName = require_regexp.toRegExpGroupMatcher(optionsPayload?.ignoreTags);
        const ignoredAttributes = [
            "data-",
            "aria-",
            "slot-scope",
            ...require_svg_attributes_weird_case.default
        ];
        if (optionsPayload && optionsPayload.ignore) ignoredAttributes.push(...optionsPayload.ignore);
        const caseConverter = require_casing.getExactConverter(shouldUseHyphenated ? "kebab-case" : "camelCase");
        function reportIssue(node, name) {
            const text = sourceCode.getText(node.key);
            context.report({
                node: node.key,
                loc: node.loc,
                data: { text },
                fix: safeFix(node.key, (fixer) => text.includes("_") || text.endsWith(".sync") || /^[A-Z]/.test(name) ? null : fixer.replaceText(node.key, text.replace(name, () => caseConverter(name)))),
                messageId: shouldUseHyphenated ? "mustBeHyphenated" : "cannotBeHyphenated"
            });
        }
        function isIgnoredAttribute(value) {
            if (ignoredAttributes.some((attr) => value.includes(attr))) return true;
            return shouldUseHyphenated ? value.toLowerCase() === value : !/-/.test(value);
        }
        return utils.defineTemplateBodyVisitor(context, { VAttribute(node) {
            const element = node.parent.parent;
            if (!utils.isCustomComponent(element) && element.name !== "slot" || isIgnoredTagName(element.rawName)) return;
            const name = getAttributeName(node);
            if (name === null || isIgnoredAttribute(name)) return;
            reportIssue(node, name);
        } });
    },
};
