import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Place engine-body statements inside regions except the final init and return.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            outside: 'Place this entire statement inside a comment region. Only the final init(); followed by the final return statement may remain outside regions.',
            openingPadding: 'Remove the blank lines immediately after this region opening.',
        },
    },

    create(context) {
        const source = context.sourceCode;

        function validateOpeningPadding(comment) {
            const next = source.getTokenAfter(comment, {includeComments: true});
            if (!next || next.loc.start.line <= comment.loc.end.line + 1) return;

            const range = [comment.range[1], next.range[0]];
            const gap = source.text.slice(...range);
            if (!/^\s*$/u.test(gap)) return;

            context.report({
                node: comment,
                messageId: 'openingPadding',
                fix(fixer) {
                    const newline = gap.match(/\r\n|[\n\r\u2028\u2029]/u)?.[0] ?? '\n';
                    const indent = source.lines[next.loc.start.line - 1].slice(0, next.loc.start.column);
                    return fixer.replaceTextRange(range, newline + indent);
                },
            });
        }

        function validateEngine(node) {
            if (!isEngineFactory(node)) return;

            const statements = node.body.body;
            const regions = [];
            const openings = [];

            for (const comment of context.sourceCode.getAllComments()) {
                if (comment.type !== 'Line' || comment.range[0] <= node.body.range[0] || comment.range[1] >= node.body.range[1]) continue;

                if (/^\s*region\b/.test(comment.value)) {
                    validateOpeningPadding(comment);
                }

                // Nested function or expression regions cannot cover engine-body statements.
                if (statements.some(statement => statement.range[0] <= comment.range[0] && comment.range[1] <= statement.range[1])) continue;

                if (/^\s*region\b/.test(comment.value)) {
                    openings.push(comment);
                } else if (/^\s*endregion\b/.test(comment.value)) {
                    const opening = openings.pop();
                    if (opening) regions.push([opening.range[1], comment.range[0]]);
                }
            }

            const last = statements.at(-1);
            const penultimate = statements.at(-2);
            const hasFinalPair = last?.type === 'ReturnStatement'
                && penultimate?.type === 'ExpressionStatement'
                && penultimate.expression.type === 'CallExpression'
                && !penultimate.expression.optional
                && penultimate.expression.callee.type === 'Identifier'
                && penultimate.expression.callee.name === 'init'
                && penultimate.expression.arguments.length === 0;

            for (const statement of statements) {
                if (hasFinalPair && (statement === last || statement === penultimate)) continue;

                if (!regions.some(([start, end]) => start <= statement.range[0] && statement.range[1] <= end)) {
                    context.report({node: statement, messageId: 'outside'});
                }
            }
        }

        return {
            FunctionDeclaration: validateEngine,
            FunctionExpression: validateEngine,
            ArrowFunctionExpression: validateEngine,
        };
    },
};
