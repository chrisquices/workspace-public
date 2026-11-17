import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/prefer-as-const.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");

export default {
    meta: {
        type: 'suggestion',
        description: 'Use const assertions instead of matching literal type assertions or annotations.',
        includeInReadme: true,
        schema: [],
        fixable: "code",
        messages: {
            "preferConstAssertion": 'Expected a `const` instead of a literal type assertion.' + " Correct this violation while preserving comments, binding scope, and behavior.",
            "variableConstAssertion": 'Expected a `const` assertion instead of a literal type annotation.' + " Correct this violation while preserving comments, binding scope, and behavior.",
            "variableSuggest": 'You should use `as const` instead of type annotation.' + " Correct this violation while preserving comments, binding scope, and behavior."
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

        function compareTypes(valueNode, typeNode, canFix) {
            if (valueNode.type === utils_1.AST_NODE_TYPES.Literal &&
                typeNode.type === utils_1.AST_NODE_TYPES.TSLiteralType &&
                typeNode.literal.type === utils_1.AST_NODE_TYPES.Literal &&
                valueNode.raw === typeNode.literal.raw) {
                if (canFix) {
                    context.report({
                        node: typeNode,
                        fix: safeFix(typeNode, fixer => fixer.replaceText(typeNode, 'const')),
                        messageId: 'preferConstAssertion'
                    });
                }
                else {
                    context.report({
                        node: typeNode,
                        messageId: 'variableConstAssertion'
                    });
                }
            }
        }
        return {
            PropertyDefinition(node) {
                if (node.value && node.typeAnnotation) {
                    compareTypes(node.value, node.typeAnnotation.typeAnnotation, false);
                }
            },
            TSAsExpression(node) {
                compareTypes(node.expression, node.typeAnnotation, true);
            },
            TSTypeAssertion(node) {
                compareTypes(node.expression, node.typeAnnotation, true);
            },
            VariableDeclarator(node) {
                if (node.init && node.id.typeAnnotation) {
                    compareTypes(node.init, node.id.typeAnnotation.typeAnnotation, false);
                }
            },
        };
    },
};
