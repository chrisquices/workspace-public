const { g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Ban inner array bracket spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "unexpectedSpaceAfter": "There should be no space after '{{tokenValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedSpaceBefore": "There should be no space before '{{tokenValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingSpaceAfter": "A space is required after '{{tokenValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "missingSpaceBefore": "A space is required before '{{tokenValue}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["never"];
        const [style] = ruleOptions;
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

        const spaced = style === "always";
        const sourceCode = context.sourceCode;
        function isOptionSet(option) {
            return ruleOptions[1] ? ruleOptions[1][option] === !spaced : false;
        }
        const options = {
            spaced,
            singleElementException: isOptionSet("singleValue"),
            objectsInArraysException: isOptionSet("objectsInArrays"),
            arraysInArraysException: isOptionSet("arraysInArrays")
        };
        function reportNoBeginningSpace(node, token) {
            const nextToken = sourceCode.getTokenAfter(token);
            context.report({
                node,
                loc: {
                    start: token.loc.end,
                    end: nextToken.loc.start
                },
                data: { tokenValue: token.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.removeRange([token.range[1], nextToken.range[0]]);
                }),
                messageId: "unexpectedSpaceAfter"
            });
        }
        function reportNoEndingSpace(node, token) {
            const previousToken = sourceCode.getTokenBefore(token);
            context.report({
                node,
                loc: {
                    start: previousToken.loc.end,
                    end: token.loc.start
                },
                data: { tokenValue: token.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.removeRange([previousToken.range[1], token.range[0]]);
                }),
                messageId: "unexpectedSpaceBefore"
            });
        }
        function reportRequiredBeginningSpace(node, token) {
            context.report({
                node,
                loc: token.loc,
                data: { tokenValue: token.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.insertTextAfter(token, " ");
                }),
                messageId: "missingSpaceAfter"
            });
        }
        function reportRequiredEndingSpace(node, token) {
            context.report({
                node,
                loc: token.loc,
                data: { tokenValue: token.value },
                fix: safeFix(node, function (fixer) {
                    return fixer.insertTextBefore(token, " ");
                }),
                messageId: "missingSpaceBefore"
            });
        }
        function isObjectType(node) {
            return node && (node.type === "ObjectExpression" || node.type === "ObjectPattern");
        }
        function isArrayType(node) {
            return node && (node.type === "ArrayExpression" || node.type === "ArrayPattern");
        }
        function validateArraySpacing(node) {
            if (options.spaced && node.elements.length === 0) return;
            const first = sourceCode.getFirstToken(node);
            const second = sourceCode.getFirstToken(node, 1);
            const last = node.type === "ArrayPattern" && node.typeAnnotation ? sourceCode.getTokenBefore(node.typeAnnotation) : sourceCode.getLastToken(node);
            const penultimate = sourceCode.getTokenBefore(last);
            const firstElement = node.elements[0];
            const lastElement = node.elements[node.elements.length - 1];
            const openingBracketMustBeSpaced = firstElement && options.objectsInArraysException && isObjectType(firstElement) || firstElement && options.arraysInArraysException && isArrayType(firstElement) || options.singleElementException && node.elements.length === 1 ? !options.spaced : options.spaced;
            const closingBracketMustBeSpaced = lastElement && options.objectsInArraysException && isObjectType(lastElement) || lastElement && options.arraysInArraysException && isArrayType(lastElement) || options.singleElementException && node.elements.length === 1 ? !options.spaced : options.spaced;
            if ((0, import_ast_utils.isTokenOnSameLine)(first, second)) {
                if (openingBracketMustBeSpaced && !sourceCode.isSpaceBetween(first, second)) reportRequiredBeginningSpace(node, first);
                if (!openingBracketMustBeSpaced && sourceCode.isSpaceBetween(first, second)) reportNoBeginningSpace(node, first);
            }
            if (first !== penultimate && (0, import_ast_utils.isTokenOnSameLine)(penultimate, last)) {
                if (closingBracketMustBeSpaced && !sourceCode.isSpaceBetween(penultimate, last)) reportRequiredEndingSpace(node, last);
                if (!closingBracketMustBeSpaced && sourceCode.isSpaceBetween(penultimate, last)) reportNoEndingSpace(node, last);
            }
        }
        return {
            ArrayPattern: validateArraySpacing,
            ArrayExpression: validateArraySpacing
        };
    },
};
