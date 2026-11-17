import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/no-wrapper-object-types.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");
const util_1 = require("../util");
const classNames = new Set([
    'BigInt',

    'Boolean',
    'Number',
    'Object',

    'String',
    'Symbol',
]);

export default {
    meta: {
        type: 'problem',
        description: "Ban global wrapper object types in favor of primitive types.",
        includeInReadme: true,
        schema: [],
        fixable: "code",
        messages: {
            "bannedClassType": 'Prefer using the primitive `{{preferred}}` as a type name, rather than the upper-cased `{{typeName}}`.' + " Correct this violation while preserving comments, binding scope, and behavior."
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

        function checkBannedTypes(node, includeFix) {
            const typeName = node.type === utils_1.AST_NODE_TYPES.Identifier && node.name;
            if (!typeName ||
                !classNames.has(typeName) ||
                !(0, util_1.isReferenceToGlobalFunction)(typeName, node, context.sourceCode)) {
                return;
            }
            const preferred = typeName.toLowerCase();
            context.report({
                node,
                data: { preferred, typeName },
                fix: safeFix(node, includeFix
                    ? (fixer) => fixer.replaceText(node, preferred)
                    : undefined),
                messageId: 'bannedClassType'
            });
        }
        return {
            TSClassImplements(node) {
                checkBannedTypes(node.expression, false);
            },
            TSInterfaceHeritage(node) {
                checkBannedTypes(node.expression, false);
            },
            TSTypeReference(node) {
                checkBannedTypes(node.typeName, true);
            },
        };
    },
};
