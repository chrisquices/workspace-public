// Native type-generic-spacing AST coverage, with token-only edits that
// preserve comments and multiline boundaries. Default type parameters use =.
const preservePrefix = new Set([
    "TSCallSignatureDeclaration", "ArrowFunctionExpression", "TSFunctionType",
    "TSConstructorType", "FunctionExpression", "ClassExpression",
]);
export default {
    meta: {
        type: "layout",
        description: "Require compact generic brackets and spaces around default type parameter equals signs.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: { spacing: "Use {{expected}} at this generic type boundary. Preserve comments, types, and multiline layout." },
    },
    create(context) {
        const source = context.sourceCode;
        function gap(left, right, expected) {
            if (!left || !right) return;
            const range = [left.range[1], right.range[0]];
            const text = source.text.slice(...range);
            if (/[\r\n\u2028\u2029]/u.test(text) || !/^\s*$/u.test(text) || text === expected) return;
            context.report({
                loc: { start: left.loc.end, end: right.loc.start },
                messageId: "spacing",
                data: { expected: expected ? "one space" : "no spaces" },
                fix(fixer) { return fixer.replaceTextRange(range, expected); },
            });
        }
        function brackets(node) {
            const opening = source.getFirstToken(node);
            const closing = source.getLastToken(node);
            if (opening?.value !== "<" || closing?.value !== ">" || !node.params.length) return;
            gap(opening, source.getTokenAfter(opening), "");
            gap(source.getTokenBefore(closing), closing, "");
        }
        return {
            TSTypeParameterInstantiation: brackets,
            TSTypeParameterDeclaration(node) {
                brackets(node);
                if (!preservePrefix.has(node.parent.type)) {
                    const opening = source.getFirstToken(node);
                    gap(source.getTokenBefore(opening), opening, "");
                }
            },
            TSTypeParameter(node) {
                if (!node.default) return;
                const first = source.getFirstToken(node.default);
                const equals = source.getTokenBefore(first);
                if (equals?.value !== "=") return;
                gap(source.getTokenBefore(equals), equals, " ");
                gap(equals, first, " ");
            },
        };
    },
};
