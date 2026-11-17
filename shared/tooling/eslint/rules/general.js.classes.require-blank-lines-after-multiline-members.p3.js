const { g: import_ast_utils, m: AST_NODE_TYPES } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
const ClassMemberTypes = {
    "*": { test: () => true },
    "field": { test: (node) => node.type === "PropertyDefinition" },
    "method": { test: (node) => node.type === "MethodDefinition" }
};

export default {
    meta: {
        type: "layout",
        description: "Require blank lines after multiline class members.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "never": "Unexpected blank line between class members." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "always": "Expected blank line between class members." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always",{"exceptAfterOverload":true,"exceptAfterSingleLine":true}];
        const [firstOption, secondOption] = ruleOptions;
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

        const configureList = typeof firstOption === "object" ? firstOption.enforce : [{
            blankLine: firstOption,
            prev: "*",
            next: "*"
        }];
        const { exceptAfterSingleLine } = secondOption;
        const exceptAfterOverload = secondOption?.exceptAfterOverload && (firstOption === "always" || typeof firstOption !== "string" && firstOption?.enforce.some(({ blankLine, prev, next }) => blankLine === "always" && prev !== "field" && next !== "field"));
        const sourceCode = context.sourceCode;
        function getBoundaryTokens(curNode, nextNode) {
            const lastToken = sourceCode.getLastToken(curNode);
            const prevToken = sourceCode.getTokenBefore(lastToken);
            const nextToken = sourceCode.getFirstToken(nextNode);
            return (0, import_ast_utils.isSemicolonToken)(lastToken) && !(0, import_ast_utils.isTokenOnSameLine)(prevToken, lastToken) && (0, import_ast_utils.isTokenOnSameLine)(lastToken, nextToken) ? {
                curLast: prevToken,
                nextFirst: lastToken
            } : {
                curLast: lastToken,
                nextFirst: nextToken
            };
        }
        function findLastConsecutiveTokenAfter(prevLastToken, nextFirstToken, maxLine) {
            const after = sourceCode.getTokenAfter(prevLastToken, { includeComments: true });
            if (after !== nextFirstToken && after.loc.start.line - prevLastToken.loc.end.line <= maxLine) return findLastConsecutiveTokenAfter(after, nextFirstToken, maxLine);
            return prevLastToken;
        }
        function findFirstConsecutiveTokenBefore(nextFirstToken, prevLastToken, maxLine) {
            const before = sourceCode.getTokenBefore(nextFirstToken, { includeComments: true });
            if (before !== prevLastToken && nextFirstToken.loc.start.line - before.loc.end.line <= maxLine) return findFirstConsecutiveTokenBefore(before, prevLastToken, maxLine);
            return nextFirstToken;
        }
        function hasTokenOrCommentBetween(before, after) {
            return sourceCode.getTokensBetween(before, after, { includeComments: true }).length !== 0;
        }
        function match(node, type) {
            return ClassMemberTypes[type].test(node);
        }
        function getPaddingType(prevNode, nextNode) {
            for (let i = configureList.length - 1; i >= 0; --i) {
                const configure = configureList[i];
                if (match(prevNode, configure.prev) && match(nextNode, configure.next)) return configure.blankLine;
            }
            return null;
        }
        function isOverload(node) {
            return (node.type === AST_NODE_TYPES.TSAbstractMethodDefinition || node.type === AST_NODE_TYPES.MethodDefinition) && node.value.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression;
        }
        return { ClassBody(node) {
            const body = exceptAfterOverload ? node.body.filter((node) => !isOverload(node)) : node.body;
            for (let i = 0; i < body.length - 1; i++) {
                const functionKinds = ["FunctionExpression", "ArrowFunctionExpression", "TSEmptyBodyFunctionExpression"];
                if (functionKinds.includes(body[i].value?.type) || functionKinds.includes(body[i + 1].value?.type)) continue;
                const curFirst = sourceCode.getFirstToken(body[i]);
                const { curLast, nextFirst } = getBoundaryTokens(body[i], body[i + 1]);
                const skip = !!(0, import_ast_utils.isTokenOnSameLine)(curFirst, curLast) && exceptAfterSingleLine;
                const beforePadding = findLastConsecutiveTokenAfter(curLast, nextFirst, 1);
                const afterPadding = findFirstConsecutiveTokenBefore(nextFirst, curLast, 1);
                const isPadded = afterPadding.loc.start.line - beforePadding.loc.end.line > 1;
                const hasTokenInPadding = hasTokenOrCommentBetween(beforePadding, afterPadding);
                const curLineLastToken = findLastConsecutiveTokenAfter(curLast, nextFirst, 0);
                const paddingType = getPaddingType(body[i], body[i + 1]);
                if (paddingType === "never" && isPadded) context.report({
                    node: body[i + 1],
                    fix: safeFix(body[i + 1], function (fixer) {
                        if (hasTokenInPadding) return null;
                        return fixer.replaceTextRange([beforePadding.range[1], afterPadding.range[0]], "\n");
                    }),
                    messageId: "never"
                });
                else if (paddingType === "always" && !skip && !isPadded) context.report({
                    node: body[i + 1],
                    fix: safeFix(body[i + 1], function (fixer) {
                        if (hasTokenInPadding) return null;
                        return fixer.insertTextAfter(curLineLastToken, "\n");
                    }),
                    messageId: "always"
                });
            }
        } };
    },
};
