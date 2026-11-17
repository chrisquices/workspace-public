import { createIfStatementFormatter } from '#eslint/helpers/create-if-statement-formatter.js';
import { isMultilineIfStatement } from '#eslint/helpers/is-multi-line-if-statement.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'layout',
        description: 'Separate multiline if chains from neighboring statements with blank lines outside comments and region markers.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            spacing: 'Add a blank line {{position}} this multiline if chain. Keep leading comments with the following statement and trailing comments with the preceding statement. Add separation outside comments and region markers.',
            manual: 'Add separation around this multiline if chain while preserving the intervening next-line directive. Move the directive with its target statement before inserting the blank line.',
        },
    },

    create(context) {
        const layout = createIfStatementFormatter(context);
        const sourceCode = context.sourceCode;

        function checkStatements(node) {
            const statements = node.body ?? node.consequent;

            for (let index = 1; index < statements.length; index++) {
                const previous = statements[index - 1];
                const current = statements[index];

                if (!isMultilineIfStatement(previous) && !isMultilineIfStatement(current)) {
                    continue;
                }

                const comments = layout.tokensFor(current).getCommentsBefore(current).filter(function (comment) {
                    return comment.range[0] >= previous.range[1];
                });
                const parts = [previous, ...comments, current];
                const separated = parts.some(function (part, position) {
                    return position > 0 && part.loc.start.line > parts[position - 1].loc.end.line + 1;
                });

                if (separated) {
                    continue;
                }

                const anchor = comments.find(function (comment) {
                    return comment.loc.start.line > previous.loc.end.line;
                }) ?? current;
                const safe = !comments.some(function (comment) {
                    return comment.loc.start.line === previous.loc.end.line && isLineDirective(comment);
                });

                context.report({
                    node: isMultilineIfStatement(current) ? current : previous,
                    messageId: safe ? 'spacing' : 'manual',
                    data: { position: isMultilineIfStatement(current) ? 'before' : 'after' },
                    fix(fixer) {
                        if (!safe) {
                            return null;
                        }

                        const start = sourceCode.getIndexFromLoc({ line: anchor.loc.start.line, column: 0 });

                        if (sourceCode.text.slice(start, anchor.range[0]).trim() !== '') {
                            return fixer.insertTextBefore(anchor, layout.newline + layout.newline + layout.indentation(previous));
                        }

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
