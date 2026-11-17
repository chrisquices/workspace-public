// Apply once to the complete source, including a whole Vue SFC.
export default {
    meta: {
        type: "layout",
        description: 'End nonempty files with a newline.',
        includeInReadme: false,
        schema: [],
        fixable: "whitespace",
        messages: { newline: "Append the missing final newline. Preserve file contents and existing line endings." },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        return {
            "Program:exit"() {
                const text = sourceCode.text;
                if (!text || text.endsWith("\n")) return;
                const newline = text.endsWith("\r") ? "\n" : text.match(/\r\n|\n/u)?.[0] ?? "\n";
                context.report({
                    loc: sourceCode.getLocFromIndex(text.length),
                    messageId: "newline",
                    fix(fixer) { return fixer.insertTextAfterRange([text.length, text.length], newline); },
                });
            },
        };
    },
};
