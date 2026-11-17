// Consecutive single-line if statements form one group. Separate its end from
// the next statement, without padding file/block edges or splitting if/else.
import { createIfStatementFormatter } from '#eslint/helpers/create-if-statement-formatter.js';
import { isMultilineIfStatement } from '#eslint/helpers/is-multi-line-if-statement.js';
import {isLineDirective} from '#eslint/helpers/is-line-directive.js';

function isSingleLineIf(node) {
    return node.type === 'IfStatement' && !isMultilineIfStatement(node);
}

export default {
    meta: {
        type: 'layout',
        description: 'Require a blank line after a group of consecutive single-line if statements.',
        includeInReadme: false,
        schema: [],
        fixable: 'whitespace',
        messages: {
            spacing: 'Add a blank line after this group of single-line if statements. Keep comments attached to their statements.',
            manual: 'Separate this single-line if group manually, preserving line-sensitive directives and their targets.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const layout = createIfStatementFormatter(context);
        const document = sourceCode.parserServices.getDocumentFragment?.();
        const scripts = document?.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');

        function checkStatements(node) {
            const statements = (node.body ?? node.consequent).filter((statement) => statement.type !== 'EmptyStatement');
            for (let index = 1; index < statements.length; index++) {
                const previous = statements[index - 1];
                const current = statements[index];
                // Multiline-if spacing already owns the boundary before a multiline if.
                if (!isSingleLineIf(previous) || current.type === 'IfStatement') continue;
                if (node.type === 'Program' && scripts && !scripts.some((script) =>
                    script.startTag.range[1] <= previous.range[0]
                    && current.range[1] <= (script.endTag?.range[0] ?? script.range[1]))) continue;

                const tokens = layout.tokensFor(current);
                const comments = tokens.getCommentsBefore(current).filter((comment) => comment.range[0] >= previous.range[1]);
                const boundaries = [previous, ...comments, current];
                if (boundaries.slice(1).some((next, position) => sourceCode.lines
                    .slice(boundaries[position].loc.end.line, next.loc.start.line - 1)
                    .some((line) => line.trim() === ''))) continue;

                const anchor = comments.find((comment) => comment.loc.start.line > previous.loc.end.line
                    || (comment.type === 'Block' && sourceCode.getText(comment).startsWith('/**'))) ?? current;
                const beforeAnchor = boundaries[boundaries.indexOf(anchor) - 1];
                const sameLine = anchor.loc.start.line === beforeAnchor.loc.end.line;
                const nearby = [...comments, ...tokens.getCommentsBefore(previous), ...tokens.getCommentsAfter(current)];
                const safe = !comments.some((comment) => comment.loc.start.line === previous.loc.end.line && isLineDirective(comment))
                    && !(sameLine && nearby.some((comment) => isLineDirective(comment)
                        && comment.loc.start.line <= anchor.loc.start.line && comment.loc.end.line + 1 >= anchor.loc.start.line));

                context.report({
                    node: current,
                    messageId: safe ? 'spacing' : 'manual',
                    fix(fixer) {
                        if (!safe) return null;
                        if (sameLine) {
                            const gap = sourceCode.text.slice(beforeAnchor.range[1], anchor.range[0]).match(/\s*$/u)[0];
                            return fixer.replaceTextRange([anchor.range[0] - gap.length, anchor.range[0]],
                                layout.newline + layout.newline + layout.indentation(previous));
                        }
                        const start = sourceCode.getIndexFromLoc({line: anchor.loc.start.line, column: 0});
                        return fixer.insertTextBeforeRange([start, start], layout.newline);
                    },
                });
            }
        }

        return layout.visitor({
            Program: checkStatements,
            BlockStatement: checkStatements,
            StaticBlock: checkStatements,
            TSModuleBlock: checkStatements,
            SwitchCase: checkStatements,
        });
    },
};
