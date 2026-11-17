const exportTypes = new Set([
    'ExportNamedDeclaration',
    'ExportDefaultDeclaration',
    'ExportAllDeclaration',
    'TSExportAssignment',
    'TSNamespaceExportDeclaration',
]);

export default {
    meta: {
        type: 'layout',
        description: 'Require a blank line between consecutive export declarations, including re-exports and TypeScript export forms. Preserve leading documentation and trailing comments.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Add a blank line between these consecutive export declarations. Keep leading documentation with the following export and trailing comments with the preceding export. Count only blank lines outside comments as separators.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        function checkExports(node) {
            for (let index = 1; index < node.body.length; index++) {
                const previous = node.body[index - 1];
                const current = node.body[index];

                if (!exportTypes.has(previous.type) || !exportTypes.has(current.type)) {
                    continue;
                }

                const comments = sourceCode.getCommentsBefore(current).filter((function (comment) { return (comment.range[0] >= previous.range[1]); }));
                const boundaries = [previous, ...comments, current];
                const needsSpacing = boundaries.slice(1).every((function (next, boundaryIndex) {
                    const before = boundaries[boundaryIndex];

                    return next.loc.start.line <= before.loc.end.line + 1
                        && sourceCode.text.slice(before.range[1], next.range[0]).trim() === '';
                }));

                if (!needsSpacing) {
                    continue;
                }

                const anchor = comments.find((function (comment) { return (comment.loc.start.line > previous.loc.end.line); })) ?? current;
                const beforeAnchor = boundaries[boundaries.indexOf(anchor) - 1];

                context.report({
                    node: current,
                    messageId: 'spacing',
                    fix(fixer) {
                        if (anchor.loc.start.line === beforeAnchor.loc.end.line) {
                            const indentation = sourceCode.lines[anchor.loc.start.line - 1].match(/^[\t ]*/u)[0];

                            return fixer.replaceTextRange([beforeAnchor.range[1], anchor.range[0]], newline + newline + indentation);
                        }

                        const start = sourceCode.getIndexFromLoc({ line: anchor.loc.start.line, column: 0 });

                        return fixer.insertTextBeforeRange([start, start], newline);
                    },
                });
            }
        }

        return {
            Program: checkExports,
            TSModuleBlock: checkExports,
        };
    },
};
