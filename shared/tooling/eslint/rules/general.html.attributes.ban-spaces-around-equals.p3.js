export default {
    meta: {
        type: 'layout',
        description: 'Remove spaces around attribute equals signs in standalone HTML.',
        includeInReadme: false,
        languages: ['html/html'],
        schema: [],
        fixable: 'whitespace',
        messages: {
            spacing: 'Remove whitespace around this attribute’s equals sign while preserving its value.',
        },
    },
    create(context) {
        const source = context.sourceCode;

        function check(node) {
            for (const attribute of node.attributes) {
                if (!attribute.value) continue;

                const text = source.text.slice(...attribute.range);
                const equals = text.indexOf('=');
                if (equals < 0) continue;

                const before = text.slice(0, equals).match(/[\t\n\f\r ]+$/u)?.[0] ?? '';
                const after = text.slice(equals + 1).match(/^[\t\n\f\r ]+/u)?.[0] ?? '';
                if (!before && !after) continue;

                const start = attribute.range[0] + equals - before.length;
                const end = attribute.range[0] + equals + 1 + after.length;
                context.report({
                    node: attribute,
                    messageId: 'spacing',
                    fix(fixer) { return fixer.replaceTextRange([start, end], '='); },
                });
            }
        }

        return { Tag: check, ScriptTag: check, StyleTag: check };
    },
};
