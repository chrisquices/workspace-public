import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Place a standalone comment before each group of listener registrations.',
        includeInReadme: true,
        schema: [],
        messages: {
            comment: 'Add a standalone comment immediately above this listener registration. Only consecutive registrations without a blank line may share a comment.',
        },
    },

    create(context) {
        const source = context.sourceCode;

        function validateEngine(engine) {
            if (!isEngineFactory(engine)) return;
            const helper = engine.body.body.find(statement => statement.type === 'FunctionDeclaration'
                && statement.id?.name === 'registerEventListener');
            if (!helper) return;
            const variable = source.getDeclaredVariables(helper).find(binding => binding.name === 'registerEventListener'
                && binding.defs.some(definition => definition.node === helper));
            if (!variable) return;

            const registrations = new Set();
            for (const reference of variable.references) {
                if (reference.isValueReference === false || !reference.isRead()) continue;
                let expression = reference.identifier;
                while (unwrap(expression.parent) === reference.identifier) expression = expression.parent;
                const call = expression.parent;
                if (call.type !== 'CallExpression' || call.callee !== expression) continue;
                let statement = call;
                while (unwrap(statement.parent) === call) statement = statement.parent;
                if (statement.parent.type === 'ExpressionStatement') statement = statement.parent;
                else if (statement.parent.type === 'VariableDeclarator' && statement.parent.init === statement
                    && statement.parent.parent.type === 'VariableDeclaration' && statement.parent.parent.declarations.length === 1) {
                    statement = statement.parent.parent;
                }
                registrations.add(statement);
            }

            for (const statement of registrations) {
                const siblings = statement.parent.type === 'BlockStatement' ? statement.parent.body : [];
                const previous = siblings[siblings.indexOf(statement) - 1];
                if (registrations.has(previous) && previous.loc.end.line === statement.loc.start.line - 1
                    && /^\s*$/.test(source.text.slice(previous.range[1], statement.range[0]))) continue;

                const comment = source.getCommentsBefore(statement).at(-1);
                const standalone = comment && comment.value.trim().length > 0
                    && comment.loc.end.line === statement.loc.start.line - 1
                    && /^\s*$/.test(source.lines[comment.loc.start.line - 1].slice(0, comment.loc.start.column))
                    && /^\s*$/.test(source.text.slice(comment.range[1], statement.range[0]));
                if (!standalone) context.report({node: statement, messageId: 'comment'});
            }
        }

        return {
            'FunctionDeclaration:exit': validateEngine,
            'FunctionExpression:exit': validateEngine,
            'ArrowFunctionExpression:exit': validateEngine,
        };
    },
};
