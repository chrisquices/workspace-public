import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Call registerAllEventListeners exactly once directly inside init.',
        includeInReadme: true,
        schema: [],
        messages: {
            declaration: 'Declare registerAllEventListeners() once directly inside the engine.',
            count: 'Call registerAllEventListeners() exactly once, directly inside init(). Found {{count}} valid calls.',
            reference: 'Call registerAllEventListeners() directly inside init(), outside loops and nested functions. Do not alias, reassign, or pass it as a callback.',
        },
    },

    create(context) {
        function validateEngine(engine) {
            if (!isEngineFactory(engine)) return;
            const declarations = engine.body.body.filter(statement => statement.type === 'FunctionDeclaration'
                && statement.id?.name === 'registerAllEventListeners' && statement.body);
            if (declarations.length !== 1) {
                context.report({node: engine, messageId: 'declaration'});
                return;
            }
            const declaration = declarations[0];
            const variable = context.sourceCode.getDeclaredVariables(declaration).find(binding => binding.name === 'registerAllEventListeners'
                && binding.defs.some(definition => definition.node === declaration));
            if (!variable) return;

            let count = 0;
            for (const reference of variable.references) {
                if (reference.isValueReference === false) continue;
                let expression = reference.identifier;
                while (unwrap(expression.parent) === reference.identifier) expression = expression.parent;
                const call = expression.parent;
                let valid = reference.isReadOnly() && call.type === 'CallExpression' && call.callee === expression
                    && !call.optional && call.arguments.length === 0 && call.parent.type === 'ExpressionStatement';
                let enclosing = call.parent;
                while (enclosing && !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(enclosing.type)) {
                    if (['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement'].includes(enclosing.type)) valid = false;
                    enclosing = enclosing.parent;
                }
                valid = valid && enclosing?.type === 'FunctionDeclaration' && enclosing.id?.name === 'init'
                    && enclosing.parent === engine.body;
                if (valid) count++;
                else context.report({node: reference.identifier, messageId: 'reference'});
            }
            if (count !== 1) context.report({node: declaration.id, messageId: 'count', data: {count}});
        }

        return {
            'FunctionDeclaration:exit': validateEngine,
            'FunctionExpression:exit': validateEngine,
            'ArrowFunctionExpression:exit': validateEngine,
        };
    },
};
