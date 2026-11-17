// Only array literals: keep compact primitive arrays and empty arrays unchanged.
export default {
    meta: {
        type: 'layout',
        description: 'Require structured or already multiline array literals to put brackets and elements on separate lines.',
        includeInReadme: false,
        schema: [],
        fixable: 'whitespace',
        messages: {
            newline: 'Put this array bracket or element on a separate line. Preserve values, commas, and array holes.',
            manual: 'Separate this array boundary manually, preserving comments and line-sensitive directive targets.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const newline = sourceCode.text.match(/\r\n|[\r\n\u2028\u2029]/u)?.[0] ?? '\n';
        const comments = sourceCode.getAllComments();
        const wrappers = new Set(['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ParenthesizedExpression']);

        function structured(element) {
            if (element?.type === 'SpreadElement') element = element.argument;
            while (element && wrappers.has(element.type)) element = element.expression;
            return element?.type === 'ObjectExpression' || element?.type === 'ArrayExpression';
        }

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
            ArrayExpression(node) {
                if (!node.elements.length || (node.loc.start.line === node.loc.end.line && !node.elements.some(structured))) return;
                const open = sourceCode.getFirstToken(node);
                const close = sourceCode.getLastToken(node);
                const indent = sourceCode.lines[node.loc.start.line - 1].match(/^[\t ]*/u)[0];
                const inner = indent + '    ';
                separate(open, sourceCode.getTokenAfter(open, {includeComments: true}), inner);
                for (const element of node.elements) {
                    if (!element) continue;
                    const first = sourceCode.getFirstToken(element);
                    const previous = sourceCode.getTokenBefore(first, {includeComments: true});
                    if (previous.range[0] !== open.range[0]) separate(previous, first, inner);
                }
                separate(sourceCode.getTokenBefore(close, {includeComments: true}), close, indent);
            },
        };
    },
};
