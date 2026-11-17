import require_index from "eslint-plugin-vue/dist/utils/index.js";
import require_js_reserved from "eslint-plugin-vue/dist/utils/js-reserved.js";
const utils = require_index.default;
const RESERVED_NAMES = new Set(require_js_reserved.default);

export default {
    meta: {
        type: "suggestion",
        description: 'Do not use redundant this references in Vue templates.',
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "unexpected": "Unexpected usage of 'this'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expected": "Expected 'this'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["never"];
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

        const options = ruleOptions[0] === "always" ? "always" : "never";
        let scopeStack = null;
        return utils.defineTemplateBodyVisitor(context, {
            VElement(node) {
                scopeStack = {
                    parent: scopeStack,
                    nodes: scopeStack ? [...scopeStack.nodes] : []
                };
                if (node.variables) for (const variable of node.variables) {
                    const varNode = variable.id;
                    const name = varNode.name;
                    if (scopeStack.nodes.every((node) => node.name !== name)) scopeStack.nodes.push(varNode);
                }
            },
            "VElement:exit"() {
                scopeStack &&= scopeStack.parent;
            },
            ...options === "never" ? { "VExpressionContainer MemberExpression > ThisExpression"(node) {
                if (!scopeStack) return;
                const propertyName = utils.getStaticPropertyName(node.parent);
                if (!propertyName || scopeStack.nodes.some((el) => el.name === propertyName) || RESERVED_NAMES.has(propertyName) || /^\d.*$|[^\w$]/.test(propertyName)) return;
                context.report({
                    node,
                    loc: node.loc,
                    fix: safeFix(node, function (fixer) {
                        return fixer.replaceText(node.parent, propertyName);
                    }),
                    messageId: "unexpected"
                });
            } } : { VExpressionContainer(node) {
                if (!scopeStack || node.parent.type === "VDirectiveKey") return;
                if (node.references) {
                    for (const reference of node.references) if (scopeStack.nodes.every((el) => el.name !== reference.id.name)) context.report({
                        node: reference.id,
                        loc: reference.id.loc,
                        fix: safeFix(reference.id, function (fixer) {
                            return fixer.insertTextBefore(reference.id, "this.");
                        }),
                        messageId: "expected"
                    });
                }
            } }
        });
    },
};
