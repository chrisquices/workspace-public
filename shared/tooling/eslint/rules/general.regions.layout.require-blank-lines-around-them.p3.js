import { codeRegionMessages, createCodeRegionVisitor } from '#eslint/helpers/create-code-region-visitor.js';

export default {
    meta: {
        type: 'layout',
        description: 'Place a blank line before region openings and after region closings.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            ...codeRegionMessages,
            spacing: 'Add a blank line {{side}} to separate the code region from surrounding code. Preserve the opening and closing lines, indentation, and enclosed code.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const lines = sourceCode.lines;
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        return createCodeRegionVisitor(context, function (regions) {
            for (const region of regions) {
                if (!region.standalone) {
                    continue;
                }

                const line = region.comment.loc.start.line;
                const needsBefore = region.isOpening && (line === 1 || lines[line - 2].trim() !== '');
                const nextLine = lines[line];
                const hasBlankAfter = nextLine !== undefined && nextLine.trim() === ''
                    && (line < lines.length - 1 || nextLine.length > 0);
                const needsAfter = !region.isOpening && !hasBlankAfter;

                if (!needsBefore && !needsAfter) {
                    continue;
                }

                context.report({
                    loc: region.comment.loc,
                    messageId: 'spacing',
                    data: { side: region.isOpening ? 'before the region opening line' : 'after the endregion closing line' },
                    fix(fixer) {
                        if (needsBefore) {
                            const start = sourceCode.getIndexFromLoc({ line: line, column: 0 });

                            return fixer.insertTextBeforeRange([start, start], newline);
                        }

                        if (line < lines.length) {
                            const start = sourceCode.getIndexFromLoc({ line: line + 1, column: 0 });

                            return fixer.insertTextBeforeRange([start, start], newline);
                        }

                        const end = sourceCode.text.length;

                        return fixer.insertTextAfterRange([end, end], newline + newline);
                    },
                });
            }
        });
    },
};
