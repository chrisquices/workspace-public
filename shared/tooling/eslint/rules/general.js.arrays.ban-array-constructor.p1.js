import { createRequire } from "node:module";
const require = createRequire(new URL("./dist/rules/no-array-constructor.js", import.meta.resolve("@typescript-eslint/eslint-plugin/package.json")));
const utils_1 = require("@typescript-eslint/utils");
const ast_utils_1 = require("@typescript-eslint/utils/ast-utils");

export default {
    meta: {
        type: 'suggestion',
        description: "Use array literals instead of Array constructors with zero or multiple arguments.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "useLiteral": "Replace this Array constructor call with an array literal containing the same elements. Preserve evaluation order and comments; if the behavior is unclear, ask the developer."
        },
    },
    create(context) {
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {
                if (target?.optional || target?.arguments?.some(function (argument) { return argument.type === "SpreadElement"; })) return null;
                for (let scope = sourceForFixes.getScope(target); scope; scope = scope.upper) {
                    if (scope.set.get("Array")?.defs?.length) return null;
                }
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
        function getArgumentsText(node) {
            const lastToken = sourceCode.getLastToken(node);
            if (lastToken == null || !(0, ast_utils_1.isClosingParenToken)(lastToken)) {
                return '';
            }
            let firstToken = node.callee;
            do {
                firstToken = sourceCode.getTokenAfter(firstToken);
                if (!firstToken || firstToken === lastToken) {
                    return '';
                }
            } while (!(0, ast_utils_1.isOpeningParenToken)(firstToken));
            return sourceCode.text.slice(firstToken.range[1], lastToken.range[0]);
        }
        /**
         * Disallow construction of dense arrays using the Array constructor
         * @param node node to evaluate
         */
        function check(node) {
            for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
                if (scope.set.get("Array")?.defs?.length) return;
            }
            if (node.arguments.length !== 1 &&
                node.callee.type === utils_1.AST_NODE_TYPES.Identifier &&
                node.callee.name === 'Array' &&
                !node.typeArguments) {
                context.report({
                    node,
                    fix: safeFix(node, function (fixer) {
                        const argsText = getArgumentsText(node);
                        return fixer.replaceText(node, `[${argsText}]`);
                    }),
                    messageId: 'useLiteral'
                });
            }
        }
        return {
            CallExpression: check,
            NewExpression: check,
        };
    },
};
