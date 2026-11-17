// Separate the enclosing call's closing parenthesis when its final argument
// is a multiline method chain, or a concise arrow/await expression yielding it.
// Keep method callback closers intact; commas remain owned by comma formatting.
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import {isLineDirective} from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'layout',
        description: 'Require an enclosing call closing parenthesis on a separate line after a final argument ending in a multiline method chain.',
        includeInReadme: false,
        schema: [],
        fixable: 'whitespace',
        messages: {
            newline: 'Put this enclosing call’s closing parenthesis on a separate line after the multiline method chain. Preserve arguments and trailing-comma policy.',
            manual: 'Separate this enclosing call’s closing parenthesis manually, preserving comments and line-sensitive directive targets.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\r\n\u2028\u2029]/u)?.[0] ?? '\n';
        const directives = sourceCode.getAllComments().filter(isLineDirective);

        return {
            CallExpression(node) {
                let tail = node.arguments.at(-1);
                while (tail) {
                    tail = unwrapExpression(tail);
                    if (tail?.type === 'ParenthesizedExpression') tail = tail.expression;
                    else if (tail?.type === 'AwaitExpression') tail = tail.argument;
                    else if (tail?.type === 'ArrowFunctionExpression' && tail.body.type !== 'BlockStatement') tail = tail.body;
                    else break;
                }
                if (tail?.type !== 'CallExpression' || tail.loc.start.line === tail.loc.end.line) return;
                let count = 0;
                let current = tail;
                while (current) {
                    current = unwrapExpression(current);
                    if (current?.type === 'ParenthesizedExpression') {
                        current = current.expression;
                        continue;
                    }
                    if (current?.type === 'MemberExpression') {
                        current = current.object;
                        continue;
                    }
                    if (current?.type !== 'CallExpression') break;
                    const member = unwrapExpression(current.callee);
                    if (member?.type !== 'MemberExpression') break;
                    count++;
                    current = member.object;
                }
                if (count < 2) return;

                const closing = sourceCode.getLastToken(node);
                if (closing.value !== ')') return;
                const previous = sourceCode.getTokenBefore(closing, {includeComments: true});
                if (previous.loc.end.line < closing.loc.start.line) return;
                const range = [previous.range[1], closing.range[0]];
                const manual = ['Line', 'Block'].includes(previous.type)
                    || !/^[\t \f]*$/u.test(sourceCode.text.slice(...range))
                    || directives.some((comment) => comment.loc.start.line <= closing.loc.start.line
                        && comment.loc.end.line + 1 >= previous.loc.end.line);
                const indent = sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/u)[0];
                context.report({
                    loc: closing.loc,
                    messageId: manual ? 'manual' : 'newline',
                    fix: manual ? undefined : (fixer) => fixer.replaceTextRange(range, newline + indent),
                });
            },
        };
    },
};
