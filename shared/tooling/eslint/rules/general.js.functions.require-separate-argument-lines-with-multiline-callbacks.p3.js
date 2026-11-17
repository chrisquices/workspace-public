// Calls with multiple arguments and a direct multiline callback place each
// argument below its delimiter and the final parenthesis on a separate line.
// Single-argument calls and callbacks nested inside options objects are outside
// this rule. Existing indentation and trailing-comma rules own those details.
// Edit only whitespace at argument boundaries, retaining parentheses, comments,
// and values. Line-sensitive directive boundaries require manual correction.

import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import { isLineDirective } from '#eslint/helpers/is-line-directive.js';

export default {
    meta: {
        type: 'layout',
        description: 'Require separate argument lines and a separate closing parenthesis in calls with multiple arguments and a multiline callback.',
        includeInReadme: false,
        fixable: 'whitespace',
        schema: [],
        messages: {
            argument: 'Start each argument on a separate indented line because this call has multiple arguments and a multiline callback. Preserve comments and argument values.',
            closing: 'Put this call’s closing parenthesis on a separate line after its arguments. Preserve trailing-comma policy.',
            manual: 'Separate this call boundary manually, preserving comments and line-sensitive directive targets.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\r\n\u2028\u2029]/u)?.[0] ?? '\n';
        const directives = sourceCode.getAllComments().filter(isLineDirective);

        function isMultilineCallback(argument) {
            let value = unwrapExpression(argument);
            while (value?.type === 'ParenthesizedExpression') value = unwrapExpression(value.expression);

            return ['FunctionExpression', 'ArrowFunctionExpression'].includes(value?.type)
                && value.loc.start.line < value.loc.end.line;
        }

        function separate(left, right, indent, isClosing) {
            if (!left || !right || left.loc.end.line < right.loc.start.line) return;

            const range = [left.range[1], right.range[0]];
            const manual = !/^[\t \f]*$/u.test(sourceCode.text.slice(...range))
                || directives.some((comment) => comment.loc.start.line <= right.loc.start.line
                    && comment.loc.end.line + 1 >= left.loc.end.line);

            context.report({
                loc: right.loc,
                messageId: manual ? 'manual' : (isClosing ? 'closing' : 'argument'),
                fix: manual ? undefined : (fixer) => fixer.replaceTextRange(range, newline + indent),
            });
        }

        return {
            CallExpression(node) {
                if (node.arguments.length < 2 || !node.arguments.some(isMultilineCallback)) return;

                const closing = sourceCode.getLastToken(node);
                if (closing.value !== ')') return;

                const opening = sourceCode.getTokenAfter(node.typeArguments ?? node.typeParameters ?? node.callee,
                    (token) => token.value === '(');
                if (!opening || opening.range[0] >= node.arguments[0].range[0]) return;

                const indent = sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/u)[0];
                for (let index = 0; index < node.arguments.length; index++) {
                    const delimiter = index === 0 ? opening : sourceCode.getTokensBetween(
                        node.arguments[index - 1], node.arguments[index],
                    ).find((token) => token.value === ',');
                    if (!delimiter) continue;

                    separate(delimiter, sourceCode.getTokenAfter(delimiter, { includeComments: true }), indent + '    ', false);
                }

                separate(sourceCode.getTokenBefore(closing, { includeComments: true }), closing, indent, true);
            },
        };
    },
};
