// Include the first method in chains of two or more.
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import {isLineDirective} from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'layout',
        description: 'Require a newline before every method call, including the first, in chains of two or more methods.',
        includeInReadme: false,
        schema: [],
        fixable: 'whitespace',
        messages: {
            newline: 'Put this method call on a new line. Chains of two or more methods must break before the first method and every subsequent method, preserving receiver properties and call order.',
            manual: 'Put this chained method on a new line manually, preserving comments and line-sensitive directive targets.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\r\n\u2028\u2029]/u)?.[0] ?? '\n';
        const directives = sourceCode.getAllComments().filter(isLineDirective);
        const reported = new Set();

        return {
            CallExpression(node) {
                const methods = [];
                let current = node;
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
                    methods.push(member);
                    current = member.object;
                }
                if (methods.length < 2) return;

                const indent = sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/u)[0] + '    ';
                for (const member of methods) {
                    // Parentheses around the receiver/property are not part of
                    // their AST ranges. Find the actual access punctuation.
                    const prefix = sourceCode.getTokensBetween(member.object, member.property)
                        .find((token) => ['.', '?.', '['].includes(token.value));
                    if (!prefix || reported.has(prefix.range[0])) continue;
                    const previous = sourceCode.getTokenBefore(prefix, {includeComments: true});
                    if (!previous || previous.loc.end.line < prefix.loc.start.line) continue;
                    reported.add(prefix.range[0]);
                    const range = [previous.range[1], prefix.range[0]];
                    const manual = ['Line', 'Block'].includes(previous.type)
                        || !/^[\t \f]*$/u.test(sourceCode.text.slice(...range))
                        || directives.some((comment) => comment.loc.start.line <= prefix.loc.start.line
                            && comment.loc.end.line + 1 >= previous.loc.end.line);
                    context.report({
                        loc: prefix.loc,
                        messageId: manual ? 'manual' : 'newline',
                        fix: manual ? undefined : (fixer) => fixer.replaceTextRange(range, newline + indent),
                    });
                }
            },
        };
    },
};
