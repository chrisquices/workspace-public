import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'End each UI engine with init, a blank line, and an object return outside regions.',
        includeInReadme: true,
        schema: [],
        messages: {
            ending: 'End the engine with init(); immediately followed by return {…};. Move other statements before this final pair while preserving initialization behavior.',
            spacing: 'Separate init(); and return {…}; with exactly one blank line and no intervening comments.',
            trailing: 'The return must be the final content before the engine closing brace. Move comments, including region markers, before init();.',
            region: 'Close all engine regions before the final init(); call. Keep init(); and the returned handle outside regions.',
        },
    },

    create(context) {
        function validateEngine(node) {
            if (!isEngineFactory(node)) return;

            const statements = node.body.body;
            const last = statements.at(-1);
            const penultimate = statements.at(-2);
            const hasFinalPair = last?.type === 'ReturnStatement'
                && last.argument?.type === 'ObjectExpression'
                && penultimate?.type === 'ExpressionStatement'
                && penultimate.expression.type === 'CallExpression'
                && !penultimate.expression.optional
                && penultimate.expression.callee.type === 'Identifier'
                && penultimate.expression.callee.name === 'init'
                && penultimate.expression.arguments.length === 0;

            if (!hasFinalPair) {
                context.report({node: last ?? node, messageId: 'ending'});
                return;
            }

            const gap = context.sourceCode.text.slice(penultimate.range[1], last.range[0]);
            if (!/^\s*$/.test(gap) || last.loc.start.line - penultimate.loc.end.line !== 2) {
                context.report({node: last, messageId: 'spacing'});
            }

            const closingBrace = context.sourceCode.getLastToken(node.body);
            const trailing = context.sourceCode.text.slice(last.range[1], closingBrace.range[0]);
            if (!/^\s*$/.test(trailing)) {
                context.report({node: context.sourceCode.getTokenAfter(last, {includeComments: true}), messageId: 'trailing'});
            }

            let depth = 0;
            for (const comment of context.sourceCode.getAllComments()) {
                if (comment.type !== 'Line' || comment.range[0] <= node.body.range[0]
                    || comment.range[0] >= penultimate.range[0]) continue;
                if (statements.some(statement => statement.range[0] <= comment.range[0]
                    && comment.range[1] <= statement.range[1])) continue;
                if (/^\s*region\b/.test(comment.value)) depth++;
                else if (/^\s*endregion\b/.test(comment.value)) depth = Math.max(0, depth - 1);
            }
            const lateRegion = context.sourceCode.getAllComments().some(comment => comment.type === 'Line'
                && comment.range[0] >= penultimate.range[0] && comment.range[1] < node.body.range[1]
                && /^\s*(?:end)?region\b/.test(comment.value));
            if (depth > 0 || lateRegion) context.report({node: penultimate, messageId: 'region'});
        }

        return {
            FunctionDeclaration: validateEngine,
            FunctionExpression: validateEngine,
            ArrowFunctionExpression: validateEngine,
        };
    },
};
