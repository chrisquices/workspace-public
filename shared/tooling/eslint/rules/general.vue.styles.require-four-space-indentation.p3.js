// Indent existing CSS lines by four spaces per enclosing block. Top-level
// selectors, at-rules, and comments start at column zero. Block contents gain
// one level and closing braces align with their block. Edit only line-leading
// whitespace at AST node boundaries, preserving values, strings, multiline
// continuations, comment contents, line endings, and declaration placement.

import { cssStyleMessages, forEachVueStyleBlock } from '#eslint/helpers/for-each-vue-style-block.js';

export default {
    meta: {
        type: 'layout',
        description: 'Indent CSS in Vue style blocks by four spaces per nesting level.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            ...cssStyleMessages,
            indentation: 'Indent this CSS line with {{spaces}} spaces for its block nesting level. Align closing braces with their opening rule or at-rule. Preserve selectors, declarations, values, and comments.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;

        function checkIndentation(index, depth) {
            const location = sourceCode.getLocFromIndex(index);
            const start = sourceCode.getIndexFromLoc({ line: location.line, column: 0 });
            const current = sourceCode.text.slice(start, index);
            const expected = '    '.repeat(depth);

            if (!/^[\t\f ]*$/u.test(current) || current === expected) {
                return;
            }

            context.report({
                loc: { start: { line: location.line, column: 0 }, end: location },
                messageId: 'indentation',
                data: { spaces: depth * 4 },
                fix(fixer) {
                    return fixer.replaceTextRange([start, index], expected);
                },
            });
        }

        return {
            Program() {
                forEachVueStyleBlock(context, function ({ root, offset }) {
                    root.walk(function (node) {
                        let depth = 0;

                        for (let parent = node.parent; parent.type !== 'root'; parent = parent.parent) {
                            depth++;
                        }

                        checkIndentation(offset + node.source.start.offset, depth);

                        if (node.nodes) {
                            const closing = offset + node.source.end.offset - 1;

                            if (sourceCode.text[closing] === '}') {
                                checkIndentation(closing, depth);
                            }
                        }
                    });
                });
            },
        };
    },
};
