export default {
    meta: {
        type: 'layout',
        description: 'Use double quotes for standalone HTML attribute values.',
        includeInReadme: false,
        languages: ['html/html'],
        schema: [],
        fixable: 'code',
        messages: {
            quotes: 'Use double quotes around this attribute value. Preserve the decoded value and existing entities.',
        },
    },
    create(context) {
        const source = context.sourceCode;

        function check(node) {
            for (const attribute of node.attributes) {
                if (!attribute.value) continue;

                const opening = attribute.startWrapper;
                const closing = attribute.endWrapper;
                if (opening?.value === '"' && closing?.value === '"') continue;

                const start = opening?.range[0] ?? attribute.value.range[0];
                const end = closing?.range[1] ?? attribute.value.range[1];
                const value = source.text.slice(...attribute.value.range);
                context.report({
                    node: attribute,
                    messageId: 'quotes',
                    fix(fixer) {
                        return fixer.replaceTextRange([start, end], `"${value.replaceAll('"', '&quot;')}"`);
                    },
                });
            }
        }

        return { Tag: check, ScriptTag: check, StyleTag: check };
    },
};
