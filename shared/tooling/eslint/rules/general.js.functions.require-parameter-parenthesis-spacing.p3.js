// Anonymous functions and async arrows use a space; named functions do not.
// Keyword spacing owns the catch parameter boundary.
const { g: import_ast_utils, m: AST_NODE_TYPES } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require parameter-parenthesis spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedSpace": "Unexpected space before function parentheses." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingSpace": "Missing space before function parentheses." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"anonymous":"always","named":"never","asyncArrow":"always"}];
        const [options] = ruleOptions;
        const sourceForFixes = context.sourceCode;
        const commentsForFixes = [...sourceForFixes.getAllComments(), ...(sourceForFixes.parserServices.getDocumentFragment?.()?.comments ?? [])];
        function safeFix(target, change) {
            if (typeof change !== "function") return null;
            return function (fixer) {

                const result = change(fixer);
                if (!result) return null;
                const newline = sourceForFixes.text.match(/\r\n|\n|\r/u)?.[0] ?? "\n";
                const edits = (result.range ? [result] : [...result]).map(function (edit) {
                    return { range: edit.range, text: edit.text.replace(/\r\n|\n|\r/gu, newline) };
                });
                for (const edit of edits) {
                    const before = sourceForFixes.text.slice(...edit.range);
                    if (before.replace(/\s/gu, "") !== edit.text.replace(/\s/gu, "")) return null;
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
        const { asyncArrow, anonymous, named } = options;
        function isNamedFunction(node) {
            if (node.id != null) return true;
            const parent = node.parent;
            return parent.type === AST_NODE_TYPES.MethodDefinition || parent.type === AST_NODE_TYPES.TSAbstractMethodDefinition || parent.type === AST_NODE_TYPES.Property && (parent.kind === "get" || parent.kind === "set" || parent.method);
        }
        function getConfigForFunction(node) {
            if (node.type === AST_NODE_TYPES.ArrowFunctionExpression) {
                if (node.async && (0, import_ast_utils.isOpeningParenToken)(sourceCode.getFirstToken(node, { skip: 1 }))) return asyncArrow;
            } else if (isNamedFunction(node)) return named;
            else if (!node.generator) return anonymous;
            return "ignore";
        }
        function checkFunction(node) {
            const functionConfig = getConfigForFunction(node);
            if (functionConfig === "ignore") return;
            if (functionConfig === "always" && node.typeParameters && !node.id) return;
            let leftToken;
            let rightToken;
            if (node.typeParameters) {
                leftToken = sourceCode.getLastToken(node.typeParameters);
                rightToken = sourceCode.getTokenAfter(leftToken);
            } else {
                rightToken = sourceCode.getFirstToken(node, import_ast_utils.isOpeningParenToken);
                leftToken = sourceCode.getTokenBefore(rightToken);
            }
            checkSpace(node, leftToken, rightToken, functionConfig);
        }
        function checkSpace(node, leftToken, rightToken, option) {
            const hasSpacing = sourceCode.isSpaceBetween(leftToken, rightToken);
            if (hasSpacing && option === "never") context.report({
                node,
                loc: {
                    start: leftToken.loc.end,
                    end: rightToken.loc.start
                },
                fix: safeFix(node, (fixer) => {
                    const comments = sourceCode.getCommentsBefore(rightToken);
                    if (comments.some((comment) => comment.type === "Line")) return null;
                    return fixer.replaceTextRange([leftToken.range[1], rightToken.range[0]], comments.reduce((text, comment) => text + sourceCode.getText(comment), ""));
                }),
                messageId: "unexpectedSpace"
            });
            else if (!hasSpacing && option === "always") context.report({
                node,
                loc: rightToken.loc,
                fix: safeFix(node, (fixer) => fixer.insertTextAfter(leftToken, " ")),
                messageId: "missingSpace"
            });
        }
        return {
            ArrowFunctionExpression: checkFunction,
            FunctionDeclaration: checkFunction,
            FunctionExpression: checkFunction,
            TSEmptyBodyFunctionExpression: checkFunction,
            TSDeclareFunction: checkFunction,
        };
    },
};
