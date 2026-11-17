import { resolveImportOrigin } from '#eslint/helpers/resolve-import-origin.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'layout',
        description: 'Separate standalone Vue watch calls from neighboring statements with blank lines.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Separate this Vue watch call from the neighboring statement with a blank line. Keep comments attached to their statements.',
            manual: 'Separate this Vue watch call from the neighboring statement with a blank line manually, preserving line-sensitive directives and their targets.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();
        if (!document) return {};

        const scripts = document.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';
        const lineDirectives = sourceCode.getAllComments().filter(isLineDirective);

        function isWatchStatement(statement) {
            if (statement.type !== 'ExpressionStatement') return false;
            const expression = unwrapExpression(statement.expression);
            if (expression?.type !== 'CallExpression') return false;

            const binding = resolveImportOrigin(expression.callee, sourceCode);
            return binding?.source === 'vue' && binding.name === 'watch';
        }

        function checkStatements(node) {
            const statements = (node.body ?? node.consequent).filter((statement) => statement.type !== 'EmptyStatement');

            for (let index = 1; index < statements.length; index++) {
                const previous = statements[index - 1];
                const current = statements[index];
                if (!isWatchStatement(previous) && !isWatchStatement(current)) continue;
                if (!scripts.some((script) => script.startTag.range[1] <= previous.range[0]
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
                const sameLine = anchor.loc.start.line === beforeAnchor.loc.end.line;
                const safe = !comments.some((comment) => comment.loc.start.line === previous.loc.end.line && isLineDirective(comment))
                    && !(sameLine && lineDirectives.some((comment) => comment.loc.start.line <= anchor.loc.start.line
                        && comment.loc.end.line + 1 >= anchor.loc.start.line));

                context.report({
                    node: current,
                    messageId: safe ? 'spacing' : 'manual',
                    fix(fixer) {
                        if (!safe) return null;
                        if (sameLine) {
                            const gap = sourceCode.text.slice(beforeAnchor.range[1], anchor.range[0]).match(/\s*$/u)[0];
                            const indent = sourceCode.lines[anchor.loc.start.line - 1].match(/^[\t ]*/u)[0];
                            return fixer.replaceTextRange([anchor.range[0] - gap.length, anchor.range[0]], newline + newline + indent);
                        }

                        const start = sourceCode.getIndexFromLoc({ line: anchor.loc.start.line, column: 0 });
                        return fixer.insertTextBeforeRange([start, start], newline);
                    },
                });
            }
        }

        return {
            Program: checkStatements,
            BlockStatement: checkStatements,
            StaticBlock: checkStatements,
            TSModuleBlock: checkStatements,
            SwitchCase: checkStatements,
        };
    },
};
