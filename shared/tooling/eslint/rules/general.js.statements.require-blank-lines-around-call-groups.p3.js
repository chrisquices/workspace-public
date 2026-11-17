// Consecutive standalone calls form a group, including awaited/optional calls.
// Separate groups from neighboring statements without adding block-edge padding.
// Follow existing statement-spacing conventions for comments and Vue scripts.
import {isLineDirective} from '#eslint/helpers/is-line-directive.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

function isCallStatement(statement) {
    if (statement.type !== 'ExpressionStatement') return false;
    let expression = statement.expression;
    while (expression) {
        expression = unwrapExpression(expression);
        if (expression?.type === 'AwaitExpression') expression = expression.argument;
        else if (expression?.type === 'ParenthesizedExpression') expression = expression.expression;
        else return expression?.type === 'CallExpression';
    }
    return false;
}

export default {
    meta: {
        type: 'layout',
        description: 'Require blank lines around groups of consecutive standalone function and method calls, including awaited and optional calls.',
        includeInReadme: false,
        schema: [],
        fixable: 'whitespace',
        messages: {
            spacing: 'Add a blank line {{position}} this group of standalone calls. Keep consecutive calls together and preserve attached comments.',
            manual: 'Add a blank line {{position}} this call group manually, preserving line-sensitive directives and their target statements.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const document = sourceCode.parserServices.getDocumentFragment?.();
        const scripts = document?.children.filter((node) => node.type === 'VElement' && node.rawName === 'script');
        const newline = sourceCode.text.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';
        const lineDirectives = sourceCode.getAllComments().filter(isLineDirective);

        function checkStatements(node) {
            const statements = (node.body ?? node.consequent).filter((statement) => statement.type !== 'EmptyStatement');
            for (let index = 1; index < statements.length; index++) {
                const previous = statements[index - 1];
                const current = statements[index];
                const previousCall = isCallStatement(previous);
                const currentCall = isCallStatement(current);
                if (previousCall === currentCall) continue;
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
                const sameLine = anchor.loc.start.line === beforeAnchor.loc.end.line;
                const safe = !comments.some((comment) => comment.loc.start.line === previous.loc.end.line && isLineDirective(comment))
                    && !(sameLine && lineDirectives.some((comment) => comment.loc.start.line <= anchor.loc.start.line
                        && comment.loc.end.line + 1 >= anchor.loc.start.line));

                context.report({
                    node: current,
                    messageId: safe ? 'spacing' : 'manual',
                    data: {position: currentCall ? 'before' : 'after'},
                    fix(fixer) {
                        if (!safe) return null;
                        if (sameLine) {
                            const gap = sourceCode.text.slice(beforeAnchor.range[1], anchor.range[0]).match(/\s*$/u)[0];
                            const indent = sourceCode.lines[anchor.loc.start.line - 1].match(/^[\t ]*/u)[0];
                            return fixer.replaceTextRange([anchor.range[0] - gap.length, anchor.range[0]], newline + newline + indent);
                        }
                        const start = sourceCode.getIndexFromLoc({line: anchor.loc.start.line, column: 0});
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
