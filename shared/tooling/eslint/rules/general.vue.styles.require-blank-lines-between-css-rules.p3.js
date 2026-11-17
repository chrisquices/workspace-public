import { cssStyleMessages, forEachVueStyleBlock } from '#eslint/helpers/for-each-vue-style-block.js';

export default {
    meta: {
        type: 'layout',
        description: 'Separate sibling CSS rules and at-rules in Vue style blocks with one blank line.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            ruleSpacing: 'Separate this CSS rule from the preceding sibling rule with exactly one blank line. Preserve indentation, declarations, and intervening comments.',
            ...cssStyleMessages,
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        return {
            Program() {
                const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

                forEachVueStyleBlock(context, function ({ root, offset }) {
                    root.walk((function (node) {
                        if (node.type !== 'rule' && node.type !== 'atrule') {
                            return;
                        }

                        let previous = node.prev();

                        while (previous?.type === 'comment') {
                            if (/^(?:\s*\*)*\s*#?(?:region|endregion)\b/iu.test(previous.text)) {
                                return;
                            }

                            previous = previous.prev();
                        }

                        if (!previous || (previous.type !== 'rule' && previous.type !== 'atrule')) {
                            return;
                        }

                        const whitespace = node.raws.before ?? '';
                        const indentation = whitespace.match(/[^\S\r\n\u2028\u2029]*$/u)[0];
                        const padding = `${newline}${newline}${indentation}`;

                        if (whitespace === padding) {
                            return;
                        }

                        const start = offset + node.source.start.offset;

                        context.report({
                            loc: sourceCode.getLocFromIndex(start),
                            messageId: 'ruleSpacing',
                            fix(fixer) {
                                return fixer.replaceTextRange([start - whitespace.length, start], padding);
                            },
                        });
                    }));
                });
            },
        };
    },
};
