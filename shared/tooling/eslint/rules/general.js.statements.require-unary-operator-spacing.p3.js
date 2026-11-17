const { w: canTokensBeAdjacent, z: isKeywordToken } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require unary operator spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedBefore": "Unexpected space before unary operator '{{operator}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedAfter": "Unexpected space after unary operator '{{operator}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedAfterWord": "Unexpected space after unary word operator '{{word}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "requireAfterWord": "Unary word operator '{{word}}' must be followed by whitespace." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "requireAfter": "Unary operator '{{operator}}' must be followed by whitespace." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "requireBefore": "Space is required before unary operator '{{operator}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"words":true,"nonwords":false}];
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

        const { words, nonwords, overrides = {} } = options;
        const sourceCode = context.sourceCode;
        function isFirstBangInBangBangExpression(node) {
            return node && node.type === "UnaryExpression" && node.argument && node.argument.type === "UnaryExpression" && node.argument.operator === "!";
        }
        function verifyWordHasSpaces(node, firstToken, secondToken, word) {
            if (secondToken.range[0] === firstToken.range[1]) context.report({
                node,
                data: { word },
                fix: safeFix(node, function (fixer) {
                    return fixer.insertTextAfter(firstToken, " ");
                }),
                messageId: "requireAfterWord"
            });
        }
        function verifyWordDoesntHaveSpaces(node, firstToken, secondToken, word) {
            if (canTokensBeAdjacent(firstToken, secondToken)) {
                if (secondToken.range[0] > firstToken.range[1]) context.report({
                    node,
                    data: { word },
                    fix: safeFix(node, function (fixer) {
                        return fixer.removeRange([firstToken.range[1], secondToken.range[0]]);
                    }),
                    messageId: "unexpectedAfterWord"
                });
            }
        }
        function checkUnaryWordOperatorForSpaces(node, firstToken, secondToken, word) {
            if (overrides[word] ?? words) verifyWordHasSpaces(node, firstToken, secondToken, word);
            else verifyWordDoesntHaveSpaces(node, firstToken, secondToken, word);
        }
        function checkForSpacesAroundNonNull(node) {
            const operator = "!";
            const operatorToken = sourceCode.getLastToken(node, (token) => token.value === operator);
            const prefixToken = sourceCode.getTokenBefore(operatorToken);
            if (overrides["ts-non-null"] ?? overrides[operator] ?? nonwords) verifyNonWordsHaveSpaces(node, prefixToken, operatorToken);
            else verifyNonWordsDontHaveSpaces(node, prefixToken, operatorToken);
        }
        function checkForSpacesAfterYield(node) {
            const tokens = sourceCode.getFirstTokens(node, 3);
            const word = "yield";
            if (!node.argument || node.delegate) return;
            checkUnaryWordOperatorForSpaces(node, tokens[0], tokens[1], word);
        }
        function checkForSpacesAfterAwait(node) {
            const tokens = sourceCode.getFirstTokens(node, 3);
            checkUnaryWordOperatorForSpaces(node, tokens[0], tokens[1], "await");
        }
        function verifyNonWordsHaveSpaces(node, firstToken, secondToken) {
            if ("prefix" in node && node.prefix) {
                if (isFirstBangInBangBangExpression(node)) return;
                if (firstToken.range[1] === secondToken.range[0]) context.report({
                    node,
                    data: { operator: firstToken.value },
                    fix: safeFix(node, function (fixer) {
                        return fixer.insertTextAfter(firstToken, " ");
                    }),
                    messageId: "requireAfter"
                });
            } else if (firstToken.range[1] === secondToken.range[0]) context.report({
                node,
                data: { operator: secondToken.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.insertTextBefore(secondToken, " ");
                }),
                messageId: "requireBefore"
            });
        }
        function verifyNonWordsDontHaveSpaces(node, firstToken, secondToken) {
            if ("prefix" in node && node.prefix) {
                if (secondToken.range[0] > firstToken.range[1]) context.report({
                    node,
                    data: { operator: firstToken.value },
                    fix: safeFix(node, function (fixer) {
                        if (canTokensBeAdjacent(firstToken, secondToken)) return fixer.removeRange([firstToken.range[1], secondToken.range[0]]);
                        return null;
                    }),
                    messageId: "unexpectedAfter"
                });
            } else if (secondToken.range[0] > firstToken.range[1]) context.report({
                node,
                data: { operator: secondToken.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.removeRange([firstToken.range[1], secondToken.range[0]]);
                }),
                messageId: "unexpectedBefore"
            });
        }
        function checkForSpaces(node) {
            const tokens = node.type === "UpdateExpression" && !node.prefix ? sourceCode.getLastTokens(node, 2) : sourceCode.getFirstTokens(node, 2);
            const firstToken = tokens[0];
            const secondToken = tokens[1];
            if ((node.type === "NewExpression" || node.prefix) && isKeywordToken(firstToken)) {
                checkUnaryWordOperatorForSpaces(node, firstToken, secondToken, firstToken.value);
                return;
            }
            if (overrides["prefix" in node && node.prefix ? tokens[0].value : tokens[1].value] ?? nonwords) verifyNonWordsHaveSpaces(node, firstToken, secondToken);
            else verifyNonWordsDontHaveSpaces(node, firstToken, secondToken);
        }
        return {
            UnaryExpression: checkForSpaces,
            UpdateExpression: checkForSpaces,
            NewExpression: checkForSpaces,
            YieldExpression: checkForSpacesAfterYield,
            AwaitExpression: checkForSpacesAfterAwait,
            TSNonNullExpression: checkForSpacesAroundNonNull
        };
    },
};
