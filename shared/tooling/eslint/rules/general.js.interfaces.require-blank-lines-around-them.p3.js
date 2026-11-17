// Separate interfaces from neighboring statements, including exported and nested
// declarations. Preserve attached documentation and physical-line directives.
// Do not add padding at file/block edges or between separate Vue script blocks.

import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

function isInterface(node) {
    return (node.declaration ?? node).type === 'TSInterfaceDeclaration';
}

export default {
    meta: {
        type: 'layout',
        description: 'Require blank lines before and after interfaces beside other statements in TypeScript and Vue scripts, including exported and nested interfaces. Preserve documentation, directive targets, and interface contents.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Separate this interface from its neighboring statement with a blank line. Keep documentation and trailing comments attached to their declarations, and preserve interface members.',
            manual: 'Add a blank line around this interface manually while preserving the intervening line directive and its target statement. Keep documentation attached to its declaration.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();
        const scripts = document?.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';

        function checkInterfaces(node) {
            const statements = (node.body ?? node.consequent).filter((statement) => statement.type !== 'EmptyStatement');

            for (let index = 1; index < statements.length; index++) {
                const previous = statements[index - 1];
                const current = statements[index];

                if (!isInterface(previous) && !isInterface(current)) continue;
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
                    node: isInterface(current) ? current : previous,
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

        return {
            Program: checkInterfaces,
            BlockStatement: checkInterfaces,
            StaticBlock: checkInterfaces,
            TSModuleBlock: checkInterfaces,
            SwitchCase: checkInterfaces,
        };
    },
};
