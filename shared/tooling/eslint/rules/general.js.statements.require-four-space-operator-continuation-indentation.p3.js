const { _: ASSIGNMENT_OPERATOR, z: isKeywordToken } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require four-space operator continuation indentation.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "wrongIndentation": "Expected indentation of {{expected}}" + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [4];
        const options = ruleOptions;
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

        const { sourceCode } = context;
        const indentStr = options[0] === "tab" ? "	" : " ".repeat(options[0] ?? 2);
        const indentCache = new Map();
        function getIndentOfLine(line) {
            if (indentCache.has(line)) return indentCache.get(line);
            return sourceCode.lines[line - 1].match(/^\s*/)?.[0] ?? "";
        }
        function subtractionIndent(indent) {
            if (options[0] === "tab") return indent.slice(1);
            return indent.slice(options[0] ?? 2);
        }
        function getTargetIndent(indent, needAdditionIndent, needSubtractionIndent) {
            if (needAdditionIndent && !needSubtractionIndent) return indent + indentStr;
            if (!needAdditionIndent && needSubtractionIndent) return subtractionIndent(indent);
            return indent;
        }
        function firstTokenOfLine(line) {
            return sourceCode.tokensAndComments.find((token) => token.loc.start.line === line);
        }
        function lastTokenOfLine(line) {
            return [...sourceCode.tokensAndComments].reverse().find((token) => token.loc.end.line === line);
        }
        function isGreaterThanCloseBracketOfLine(line) {
            const tokensAndCommentsOfLine = sourceCode.tokensAndComments.filter((token) => token.loc.start.line === line);
            let openBracketCount = 0;
            let closeBracketCount = 0;
            for (const token of tokensAndCommentsOfLine) {
                if (token.value === "(") openBracketCount++;
                if (token.value === ")") closeBracketCount++;
            }
            return openBracketCount < closeBracketCount;
        }
        function isTypeKeywordOfNode(typeToken, node) {
            while (node.parent) {
                node = node.parent;
                if (node.type === "TSTypeAliasDeclaration" && context.sourceCode.getTokenBefore(node.id) === typeToken) return true;
            }
            return false;
        }
        function handler(node, right) {
            if (node.loc.start.line === node.loc.end.line) return;
            let tokenRight = sourceCode.getFirstToken(right);
            let tokenOperator = sourceCode.getTokenBefore(tokenRight);
            while (tokenOperator.value === "(") {
                tokenRight = tokenOperator;
                tokenOperator = sourceCode.getTokenBefore(tokenRight);
                if (tokenOperator.range[0] <= right.parent.range[0]) return;
            }
            const tokenBeforeAll = sourceCode.getTokenBefore(node);
            const tokenLeft = sourceCode.getTokenBefore(tokenOperator);
            if (!(tokenRight.loc.start.line !== tokenLeft.loc.start.line)) return;
            const firstTokenOfLineLeft = firstTokenOfLine(tokenLeft.loc.start.line);
            const lastTokenOfLineLeft = lastTokenOfLine(tokenLeft.loc.start.line);
            const needAdditionIndent = isKeywordToken(firstTokenOfLineLeft) && ![
                "typeof",
                "instanceof",
                "this"
            ].includes(firstTokenOfLineLeft.value) || firstTokenOfLineLeft?.type === "Identifier" && firstTokenOfLineLeft.value === "type" && isTypeKeywordOfNode(firstTokenOfLineLeft, node) || [
                ":",
                "[",
                "(",
                "<"
            ].concat(ASSIGNMENT_OPERATOR).includes(lastTokenOfLineLeft?.value || "") || [
                "[",
                "(",
                "{",
                "=>",
                ":"
            ].concat(ASSIGNMENT_OPERATOR).includes(tokenBeforeAll?.value || "") && firstTokenOfLineLeft?.loc.start.line === tokenBeforeAll?.loc.start.line;
            const needSubtractionIndent = lastTokenOfLineLeft?.value === ")" && isGreaterThanCloseBracketOfLine(tokenLeft.loc.start.line) && ![
                "]",
                ")",
                "}"
            ].includes(firstTokenOfLineLeft?.value || "");
            const indentLeft = getIndentOfLine(tokenLeft.loc.start.line);
            const indentRight = getIndentOfLine(tokenRight.loc.start.line);
            const indentTarget = getTargetIndent(indentLeft, needAdditionIndent, needSubtractionIndent);
            if (indentTarget !== indentRight) {
                const start = {
                    line: tokenRight.loc.start.line,
                    column: 0
                };
                const end = {
                    line: tokenRight.loc.start.line,
                    column: indentRight.length
                };
                context.report({
                    loc: {
                        start,
                        end
                    },
                    data: { expected: `${indentTarget.length} ${options[0] === "tab" ? "tab" : "space"}${indentTarget.length === 1 ? "" : "s"}` },
                    fix: safeFix(null, function (fixer) {
                        return fixer.replaceTextRange([sourceCode.getIndexFromLoc(start), sourceCode.getIndexFromLoc(end)], indentTarget);
                    }),
                    messageId: "wrongIndentation"
                });
                indentCache.set(tokenRight.loc.start.line, indentTarget);
            }
        }
        return {
            BinaryExpression(node) {
                handler(node, node.right);
            },
            LogicalExpression(node) {
                handler(node, node.right);
            },
            TSUnionType(node) {
                if (node.types.length > 1) node.types.forEach((type) => {
                    handler(node, type);
                });
            },
            TSIntersectionType(node) {
                if (node.types.length > 1) node.types.forEach((type) => {
                    handler(node, type);
                });
            }
        };
    },
};
