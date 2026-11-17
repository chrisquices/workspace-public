// Only nonempty object literals, not destructuring, imports, or type bodies.
export default {
    meta: {
        type: 'layout',
        description: 'Require nonempty object literals to put braces and each property on separate lines.',
        includeInReadme: false,
        schema: [],
        fixable: 'whitespace',
        messages: {
            newline: 'Put this object brace or property on a separate line. Preserve property values, methods, spreads, and comments.',
            manual: 'Separate this object boundary manually, preserving comments and line-sensitive directive targets.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\r\n\u2028\u2029]/u)?.[0] ?? '\n';
        const comments = sourceCode.getAllComments();

        function separate(left, right, indent) {
            if (!left || !right || left.loc.end.line < right.loc.start.line) return;
            const range = [left.range[1], right.range[0]];
            const gap = sourceCode.text.slice(...range);
            const manual = !/^[\t \f]*$/u.test(gap)
                || ['Line', 'Block'].includes(left.type) || ['Line', 'Block'].includes(right.type)
                || comments.some((comment) => /eslint-(?:disable|enable)-(?:next-line|line)\b|@ts-(?:ignore|expect-error)\b/u.test(comment.value)
                    && comment.loc.start.line <= right.loc.start.line && comment.loc.end.line + 1 >= left.loc.end.line);
            context.report({
                loc: right.loc,
                messageId: manual ? 'manual' : 'newline',
                fix: manual ? undefined : (fixer) => fixer.replaceTextRange(range, newline + indent),
            });
        }

        return {
            ObjectExpression(node) {
                if (!node.properties.length) return;
                for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
                    if (ancestor.type === 'ConditionalExpression' && getSingleLineTernary(ancestor, sourceCode)) return;
                    if (!ancestor.type.endsWith('Expression') && ancestor.type !== 'Property' && ancestor.type !== 'SpreadElement') break;
                }
                const open = sourceCode.getFirstToken(node);
                const close = sourceCode.getLastToken(node);
                const indent = sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/u)[0];
                const inner = indent + '    ';
                separate(open, sourceCode.getTokenAfter(open, {includeComments: true}), inner);
                for (const property of node.properties) {
                    const first = sourceCode.getFirstToken(property);
                    const previous = sourceCode.getTokenBefore(first, {includeComments: true});
                    if (previous.range[0] !== open.range[0]) separate(previous, first, inner);
                }
                separate(sourceCode.getTokenBefore(close, {includeComments: true}), close, indent);
            },
        };
    },
};
import { getSingleLineTernary } from '#eslint/helpers/get-single-line-ternary.js';

