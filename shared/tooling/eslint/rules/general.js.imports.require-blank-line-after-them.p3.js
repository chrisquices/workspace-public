// Separate a consecutive import group from the following statement. Do not
// insert spacing between imports or across distinct Vue script blocks. Preserve
// leading documentation, trailing comments, and line-sensitive directive targets.

import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

const importTypes = new Set(['ImportDeclaration', 'TSImportEqualsDeclaration']);

export default {
    meta: {
        type: 'layout',
        description: 'Require a blank line after the final import in a consecutive import group when another statement follows in JavaScript, TypeScript, and Vue scripts. Preserve comments and directive targets.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Add a blank line after this import group, before the following statement and its leading documentation. Preserve trailing import comments and keep consecutive imports together.',
            manual: 'Separate this import group from the following statement manually. Preserve the target of the intervening line directive and keep comments attached to their declarations.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();
        const scripts = document?.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        function checkImports(node) {
            const statements = node.body.filter((statement) => statement.type !== 'EmptyStatement');

            for (let index = 1; index < statements.length; index++) {
                const previous = statements[index - 1];
                const current = statements[index];

                if (!importTypes.has(previous.type) || importTypes.has(current.type)) continue;
                if (node.type === 'Program' && scripts && !scripts.some((script) =>
                    script.startTag.range[1] <= previous.range[0]
                    && current.range[1] <= (script.endTag?.range[0] ?? script.range[1]))) continue;

                const comments = sourceCode.getCommentsBefore(current).filter((comment) => comment.range[0] >= previous.range[1]);
                const boundaries = [previous, ...comments, current];
                const separated = boundaries.slice(1).some((next, position) => sourceCode.lines
                    .slice(boundaries[position].loc.end.line, next.loc.start.line - 1)
                    .some((line) => line.trim() === ''));

                if (separated) continue;

                const anchor = comments.find((comment) => comment.loc.start.line > previous.loc.end.line
                    || (comment.type === 'Block' && sourceCode.getText(comment).startsWith('/**'))) ?? current;
                const beforeAnchor = boundaries[boundaries.indexOf(anchor) - 1];
                const safe = !comments.some((comment) => comment.loc.start.line === previous.loc.end.line && isLineDirective(comment));

                context.report({
                    node: previous,
                    messageId: safe ? 'spacing' : 'manual',
                    fix(fixer) {
                        if (!safe) return null;

                        const start = sourceCode.getIndexFromLoc({ line: anchor.loc.start.line, column: 0 });
                        if (anchor.loc.start.line === beforeAnchor.loc.end.line) {
                            const gap = sourceCode.text.slice(beforeAnchor.range[1], anchor.range[0]).match(/\s*$/u)[0];
                            const indent = sourceCode.lines[anchor.loc.start.line - 1].match(/^[\t ]*/u)[0];
                            return fixer.replaceTextRange([anchor.range[0] - gap.length, anchor.range[0]], newline + newline + indent);
                        }

                        return fixer.insertTextBeforeRange([start, start], newline);
                    },
                });
            }
        }

        return { Program: checkImports, TSModuleBlock: checkImports };
    },
};
