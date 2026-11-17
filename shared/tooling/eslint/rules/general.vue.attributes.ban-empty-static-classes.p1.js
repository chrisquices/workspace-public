// Remove empty static class attributes from Vue elements and components.
// Dynamic bindings remain untouched. Only HTML class whitespace counts as empty.
import vueUtils from "eslint-plugin-vue/dist/utils/index.js";

const utils = vueUtils.default;

export default {
    meta: {
        type: "suggestion",
        description: 'Remove empty static class attributes in Vue templates.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            emptyClass: "Remove this empty class attribute. Preserve other attributes and dynamic class bindings.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;

        return utils.defineTemplateBodyVisitor(context, {
            VAttribute(node) {
                if (node.directive || node.key.name !== "class" || !node.value) return;
                if (!/^[\t\n\f\r ]*$/u.test(node.value.value)) return;

                context.report({
                    node,
                    messageId: "emptyClass",
                    fix(fixer) {
                        let start = node.range[0];
                        while (start > 0 && /[\t ]/u.test(sourceCode.text[start - 1])) start--;

                        // Retain physical line breaks so line-sensitive directives
                        // elsewhere in the opening tag keep their original targets.
                        const lineBreaks = sourceCode.getText(node).match(/\r\n|[\r\n\u2028\u2029]/gu) ?? [];
                        return fixer.replaceTextRange([start, node.range[1]], lineBreaks.join(""));
                    },
                });
            },
        });
    },
};
