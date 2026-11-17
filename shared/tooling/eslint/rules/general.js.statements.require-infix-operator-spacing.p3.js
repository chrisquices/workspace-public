const { g: import_ast_utils, h: AST_TOKEN_TYPES, m: AST_NODE_TYPES } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));
const UNIONS = ["|", "&"];

export default {
    meta: {
        type: "layout",
        description: "Require infix operator spacing.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "missingSpace": "Operator '{{operator}}' must be spaced." + " Correct this violation while preserving comments, binding scope, and behavior."
        },
    },
    create(context) {
        const ruleOptions = [{"int32Hint":false,"ignoreTypes":false}];
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

        const { int32Hint, ignoreTypes } = options;
        const sourceCode = context.sourceCode;
        function report(node, operator) {
            context.report({
                node,
                loc: operator.loc,
                data: { operator: operator.value },
                fix: safeFix(node, function (fixer) {
                    const previousToken = sourceCode.getTokenBefore(operator);
                    const afterToken = sourceCode.getTokenAfter(operator);
                    let fixString = "";
                    if (operator.range[0] - previousToken.range[1] === 0) fixString = " ";
                    fixString += operator.value;
                    if (afterToken.range[0] - operator.range[1] === 0) fixString += " ";
                    return fixer.replaceText(operator, fixString);
                }),
                messageId: "missingSpace"
            });
        }
        function getFirstNonSpacedToken(left, right, op) {
            const operator = sourceCode.getFirstTokenBetween(left, right, (token) => token.value === op);
            const prev = sourceCode.getTokenBefore(operator);
            const next = sourceCode.getTokenAfter(operator);
            if (!sourceCode.isSpaceBetween(prev, operator) || !sourceCode.isSpaceBetween(operator, next)) return operator;
            return null;
        }
        function checkBinary(node) {
            const leftNode = "typeAnnotation" in node.left && node.left.typeAnnotation ? node.left.typeAnnotation : node.left;
            const rightNode = node.right;
            const nonSpacedNode = getFirstNonSpacedToken(leftNode, rightNode, "operator" in node && node.operator ? node.operator : "=");
            if (nonSpacedNode) {
                if (!(int32Hint && sourceCode.getText(node).endsWith("|0"))) report(node, nonSpacedNode);
            }
        }
        function isSpaceChar(token) {
            return token.type === AST_TOKEN_TYPES.Punctuator && /^[=?:]$/.test(token.value);
        }
        function checkAndReportAssignmentSpace(node, leftNode, rightNode) {
            if (!rightNode || !leftNode) return;
            const operator = sourceCode.getFirstTokenBetween(leftNode, rightNode, isSpaceChar);
            const prev = sourceCode.getTokenBefore(operator);
            const next = sourceCode.getTokenAfter(operator);
            if (!sourceCode.isSpaceBetween(prev, operator) || !sourceCode.isSpaceBetween(operator, next)) report(node, operator);
        }
        function checkPropertyAssignment(node) {
            checkAndReportAssignmentSpace(node, node.optional && !node.typeAnnotation ? sourceCode.getTokenAfter(node.key) : node.typeAnnotation ?? node.key, node.value);
        }
        function checkTSBinary(typeAnnotation) {
            typeAnnotation.types.forEach((type) => {
                const skipFunctionParenthesis = type.type === AST_NODE_TYPES.TSFunctionType ? import_ast_utils.isNotOpeningParenToken : 0;
                const operator = sourceCode.getTokenBefore(type, skipFunctionParenthesis);
                if (!ignoreTypes && operator != null && UNIONS.includes(operator.value)) {
                    const prev = sourceCode.getTokenBefore(operator);
                    const next = sourceCode.getTokenAfter(operator);
                    if (!sourceCode.isSpaceBetween(prev, operator) || !sourceCode.isSpaceBetween(operator, next)) report(typeAnnotation, operator);
                }
            });
        }
        return {
            AssignmentExpression: checkBinary,
            AssignmentPattern: checkBinary,
            BinaryExpression: checkBinary,
            LogicalExpression: checkBinary,
            ConditionalExpression(node) {
                checkAndReportAssignmentSpace(node, node.test, node.consequent);
                checkAndReportAssignmentSpace(node, node.consequent, node.alternate);
            },
            VariableDeclarator(node) {
                checkAndReportAssignmentSpace(node, node.id.typeAnnotation ?? node.id, node.init);
            },
            PropertyDefinition: checkPropertyAssignment,
            AccessorProperty: checkPropertyAssignment,
            TSEnumMember(node) {
                checkAndReportAssignmentSpace(node, node.id, node.initializer);
            },
            TSTypeAliasDeclaration(node) {
                checkAndReportAssignmentSpace(node, node.typeParameters ?? node.id, node.typeAnnotation);
            },
            TSUnionType: checkTSBinary,
            TSIntersectionType: checkTSBinary,
            TSConditionalType(node) {
                checkAndReportAssignmentSpace(node, node.extendsType, node.trueType);
                checkAndReportAssignmentSpace(node, node.trueType, node.falseType);
            }
        };
    },
};
