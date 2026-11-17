const { T: createGlobalLinebreakMatcher, g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Require line-leading operators.",
        includeInReadme: false,
        schema: [],
        fixable: "code",
        messages: {
            "operatorAtBeginning": "'{{operator}}' should be placed at the beginning of the line." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "operatorAtEnd": "'{{operator}}' should be placed at the end of the line." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "badLinebreak": "Bad line breaking before and after '{{operator}}'." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "noLinebreak": "There should be no line break before or after '{{operator}}'." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["before"];
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

        const usedDefaultGlobal = !ruleOptions[0];
        const globalStyle = ruleOptions[0] || "after";
        const options = ruleOptions[1] || {};
        const styleOverrides = options.overrides ? Object.assign({}, options.overrides) : {};
        if (usedDefaultGlobal && !styleOverrides["?"]) styleOverrides["?"] = "before";
        if (usedDefaultGlobal && !styleOverrides[":"]) styleOverrides[":"] = "before";
        const sourceCode = context.sourceCode;
        function getFixer(operatorToken, desiredStyle) {
            return (fixer) => {
                const tokenBefore = sourceCode.getTokenBefore(operatorToken);
                const tokenAfter = sourceCode.getTokenAfter(operatorToken);
                const textBefore = sourceCode.text.slice(tokenBefore.range[1], operatorToken.range[0]);
                const textAfter = sourceCode.text.slice(operatorToken.range[1], tokenAfter.range[0]);
                const hasLinebreakBefore = !(0, import_ast_utils.isTokenOnSameLine)(tokenBefore, operatorToken);
                const hasLinebreakAfter = !(0, import_ast_utils.isTokenOnSameLine)(operatorToken, tokenAfter);
                let newTextBefore, newTextAfter;
                if (hasLinebreakBefore !== hasLinebreakAfter && desiredStyle !== "none") {
                    if (sourceCode.getTokenBefore(operatorToken, { includeComments: true }) !== tokenBefore && sourceCode.getTokenAfter(operatorToken, { includeComments: true }) !== tokenAfter) return null;
                    newTextBefore = textAfter;
                    newTextAfter = textBefore;
                } else {
                    const LINEBREAK_REGEX = createGlobalLinebreakMatcher();
                    newTextBefore = desiredStyle === "before" || textBefore.trim() ? textBefore : textBefore.replace(LINEBREAK_REGEX, "");
                    newTextAfter = desiredStyle === "after" || textAfter.trim() ? textAfter : textAfter.replace(LINEBREAK_REGEX, "");
                    if (newTextBefore === textBefore && newTextAfter === textAfter) return null;
                }
                if (newTextAfter === "" && tokenAfter.type === "Punctuator" && "+-".includes(operatorToken.value) && tokenAfter.value === operatorToken.value) newTextAfter += " ";
                return fixer.replaceTextRange([tokenBefore.range[1], tokenAfter.range[0]], newTextBefore + operatorToken.value + newTextAfter);
            };
        }
        function validateNode(node, rightSide, operator) {
            const operatorToken = sourceCode.getTokenBefore(rightSide, (token) => token.value === operator);
            const leftToken = sourceCode.getTokenBefore(operatorToken);
            const rightToken = sourceCode.getTokenAfter(operatorToken);
            const operatorStyleOverride = styleOverrides[operator];
            const style = operatorStyleOverride || globalStyle;
            const fix = getFixer(operatorToken, style);
            if ((0, import_ast_utils.isTokenOnSameLine)(leftToken, operatorToken) && (0, import_ast_utils.isTokenOnSameLine)(operatorToken, rightToken)) {} else if (operatorStyleOverride !== "ignore" && !(0, import_ast_utils.isTokenOnSameLine)(leftToken, operatorToken) && !(0, import_ast_utils.isTokenOnSameLine)(operatorToken, rightToken)) context.report({
                node,
                loc: operatorToken.loc,
                data: { operator },
                fix: safeFix(node, fix),
                messageId: "badLinebreak"
            });
            else if (style === "before" && (0, import_ast_utils.isTokenOnSameLine)(leftToken, operatorToken)) context.report({
                node,
                loc: operatorToken.loc,
                data: { operator },
                fix: safeFix(node, fix),
                messageId: "operatorAtBeginning"
            });
            else if (style === "after" && (0, import_ast_utils.isTokenOnSameLine)(operatorToken, rightToken)) context.report({
                node,
                loc: operatorToken.loc,
                data: { operator },
                fix: safeFix(node, fix),
                messageId: "operatorAtEnd"
            });
            else if (style === "none") context.report({
                node,
                loc: operatorToken.loc,
                data: { operator },
                fix: safeFix(node, fix),
                messageId: "noLinebreak"
            });
        }
        function validateBinaryExpression(node) {
            validateNode(node, node.right, node.operator);
        }
        return {
            BinaryExpression: validateBinaryExpression,
            LogicalExpression: validateBinaryExpression,
            AssignmentExpression: validateBinaryExpression,
            VariableDeclarator(node) {
                if (node.init) validateNode(node, node.init, "=");
            },
            PropertyDefinition(node) {
                if (node.value) validateNode(node, node.value, "=");
            },
            AccessorProperty(node) {
                if (node.value) validateNode(node, node.value, "=");
            },
            ConditionalExpression(node) {
                validateNode(node, node.consequent, "?");
                validateNode(node, node.alternate, ":");
            },
            TSImportEqualsDeclaration(node) {
                validateNode(node, node.moduleReference, "=");
            },
            TSTypeAliasDeclaration(node) {
                validateNode(node, node.typeAnnotation, "=");
            },
            TSConditionalType(node) {
                validateNode(node, node.trueType, "?");
                validateNode(node, node.falseType, ":");
            },
            TSIntersectionType(node) {
                const { types } = node;
                for (let idx = 0; idx < types.length - 1; idx++) validateNode(types[idx], types[idx + 1], "&");
            },
            TSUnionType(node) {
                const { types } = node;
                for (let idx = 0; idx < types.length - 1; idx++) validateNode(types[idx], types[idx + 1], "|");
            },
            TSTypeParameter(node) {
                if (!node.default) return;
                validateNode(node, node.default, "=");
            },
            TSEnumMember(node) {
                if (!node.initializer) return;
                validateNode(node, node.initializer, "=");
            }
        };
    },
};
