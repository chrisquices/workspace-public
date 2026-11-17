// Format only label punctuation, never reconstruct a tuple member.
export default {
    meta: {
        type: "layout",
        description: "Require name: Type and name?: Type spacing for named tuple members.",
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: { spacing: "Format this named tuple member as name: Type or name?: Type. Preserve its type, comments, and multiline layout." },
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
                fix(fixer) { return fixer.replaceTextRange(range, expected); },
            });
        }
        return {
            TSNamedTupleMember(node) {
                let previous = source.getLastToken(node.label);
                let token = source.getTokenAfter(previous);
                if (node.optional && token?.value === "?") {
                    gap(previous, token, "");
                    previous = token;
                    token = source.getTokenAfter(token);
                }
                if (token?.value !== ":") return;
                gap(previous, token, "");
                gap(token, source.getTokenAfter(token), " ");
            },
        };
    },
};
