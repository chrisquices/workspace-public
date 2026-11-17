const { K: isSingleLine, g: import_ast_utils } = await import(new URL("./utils.js", import.meta.resolve("@stylistic/eslint-plugin")));

export default {
    meta: {
        type: "layout",
        description: "Keep ternaries on one line when safe and within 100 characters; otherwise use consistent line breaks.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: {
            "expectedTestCons": "Expected newline between test and consequent of ternary expression." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "expectedConsAlt": "Expected newline between consequent and alternate of ternary expression." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedTestCons": "Unexpected newline between test and consequent of ternary expression." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "unexpectedConsAlt": "Unexpected newline between consequent and alternate of ternary expression." + " Correct this violation while preserving comments, binding scope, and behavior.",
            "preferSingleLine": "Keep this ternary on one line when the complete line is at most 100 characters. Preserve comments and behavior."
        },
    },
    create(context) {
        const ruleOptions = ["always-multiline"];
        const [style, options = {}] = ruleOptions;
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

        const multiline = style !== "never";
        const allowSingleLine = style === "always-multiline";
        const { ignoreJSX } = options;
        const sourceCode = context.sourceCode;
        return { ConditionalExpression(node) {
            const inline = !isSingleLine(node) && getSingleLineTernary(node, sourceCode);
            if (inline) {
                context.report({
                    node,
                    messageId: "preferSingleLine",
                    fix: safeFix(node, (fixer) => fixer.replaceTextRange(node.range, inline)),
                });
                return;
            }
            const questionToken = sourceCode.getTokenAfter(node.test, import_ast_utils.isNotClosingParenToken);
            const colonToken = sourceCode.getTokenAfter(node.consequent, import_ast_utils.isNotClosingParenToken);
            const firstTokenOfTest = sourceCode.getFirstToken(node);
            const lastTokenOfTest = sourceCode.getTokenBefore(questionToken);
            const firstTokenOfConsequent = sourceCode.getTokenAfter(questionToken);
            const lastTokenOfConsequent = sourceCode.getTokenBefore(colonToken);
            const firstTokenOfAlternate = sourceCode.getTokenAfter(colonToken);
            const areTestAndConsequentOnSameLine = (0, import_ast_utils.isTokenOnSameLine)(lastTokenOfTest, firstTokenOfConsequent);
            const areConsequentAndAlternateOnSameLine = (0, import_ast_utils.isTokenOnSameLine)(lastTokenOfConsequent, firstTokenOfAlternate);
            const hasComments = !!sourceCode.getCommentsInside(node).length;
            if (ignoreJSX) {
                if (node.parent.type === "JSXElement" || node.parent.type === "JSXFragment" || node.parent.type === "JSXExpressionContainer") return null;
            }
            if (!multiline) {
                if (!areTestAndConsequentOnSameLine) context.report({
                    node: node.test,
                    loc: {
                        start: firstTokenOfTest.loc.start,
                        end: lastTokenOfTest.loc.end
                    },
                    fix: safeFix(node.test, function (fixer) {
                        if (hasComments) return null;
                        const fixers = [];
                        const areTestAndQuestionOnSameLine = (0, import_ast_utils.isTokenOnSameLine)(lastTokenOfTest, questionToken);
                        const areQuestionAndConsOnSameLine = (0, import_ast_utils.isTokenOnSameLine)(questionToken, firstTokenOfConsequent);
                        if (!areTestAndQuestionOnSameLine) fixers.push(fixer.removeRange([lastTokenOfTest.range[1], questionToken.range[0]]));
                        if (!areQuestionAndConsOnSameLine) fixers.push(fixer.removeRange([questionToken.range[1], firstTokenOfConsequent.range[0]]));
                        return fixers;
                    }),
                    messageId: "unexpectedTestCons"
                });
                if (!areConsequentAndAlternateOnSameLine) context.report({
                    node: node.consequent,
                    loc: {
                        start: firstTokenOfConsequent.loc.start,
                        end: lastTokenOfConsequent.loc.end
                    },
                    fix: safeFix(node.consequent, function (fixer) {
                        if (hasComments) return null;
                        const fixers = [];
                        const areConsAndColonOnSameLine = (0, import_ast_utils.isTokenOnSameLine)(lastTokenOfConsequent, colonToken);
                        const areColonAndAltOnSameLine = (0, import_ast_utils.isTokenOnSameLine)(colonToken, firstTokenOfAlternate);
                        if (!areConsAndColonOnSameLine) fixers.push(fixer.removeRange([lastTokenOfConsequent.range[1], colonToken.range[0]]));
                        if (!areColonAndAltOnSameLine) fixers.push(fixer.removeRange([colonToken.range[1], firstTokenOfAlternate.range[0]]));
                        return fixers;
                    }),
                    messageId: "unexpectedConsAlt"
                });
            } else {
                if (allowSingleLine && isSingleLine(node)) return;
                if (areTestAndConsequentOnSameLine) context.report({
                    node: node.test,
                    loc: {
                        start: firstTokenOfTest.loc.start,
                        end: lastTokenOfTest.loc.end
                    },
                    fix: safeFix(node.test, (fixer) => hasComments ? null : fixer.replaceTextRange([lastTokenOfTest.range[1], questionToken.range[0]], "\n")),
                    messageId: "expectedTestCons"
                });
                if (areConsequentAndAlternateOnSameLine) context.report({
                    node: node.consequent,
                    loc: {
                        start: firstTokenOfConsequent.loc.start,
                        end: lastTokenOfConsequent.loc.end
                    },
                    fix: safeFix(node.consequent, (fixer) => hasComments ? null : fixer.replaceTextRange([lastTokenOfConsequent.range[1], colonToken.range[0]], "\n")),
                    messageId: "expectedConsAlt"
                });
            }
        } };
    },
};
import { getSingleLineTernary } from '#eslint/helpers/get-single-line-ternary.js';

