import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Call init once before the final return without aliasing or passing it.',
        includeInReadme: true,
        schema: [],
        messages: {
            reference: 'Call init() exactly once, directly at the engine\'s end. Do not invoke it elsewhere, reassign it, or pass it as a callback or alias.',
            missing: 'Call init() once directly before the engine\'s final return statement.',
        },
    },

    create(context) {
        function validateEngine(node) {
            if (!isEngineFactory(node)) return;

            const statements = node.body.body;
            const declarations = statements.filter(statement => statement.type === 'FunctionDeclaration' && statement.id?.name === 'init');
            if (declarations.length !== 1) return;

            const declaration = declarations[0];
            const variable = context.sourceCode.getDeclaredVariables(declaration).find(binding => binding.name === 'init'
                && binding.defs.some(definition => definition.node === declaration));
            if (!variable) return;

            const last = statements.at(-1);
            const penultimate = statements.at(-2);
            const finalCall = last?.type === 'ReturnStatement' && penultimate?.type === 'ExpressionStatement'
                && penultimate.expression.type === 'CallExpression' && !penultimate.expression.optional
                && penultimate.expression.arguments.length === 0 ? penultimate.expression : null;
            let hasFinalCall = false;

            // Binding references include nested closures while excluding unrelated, shadowed init names.
            for (const reference of variable.references) {
                if (reference.isValueReference === false) continue;

                const identifier = reference.identifier;
                if (finalCall?.callee === identifier && reference.isReadOnly()) {
                    hasFinalCall = true;
                } else {
                    context.report({node: identifier, messageId: 'reference'});
                }
            }

            if (!hasFinalCall) context.report({node: declaration.id, messageId: 'missing'});
        }

        return {
            'FunctionDeclaration:exit': validateEngine,
            'FunctionExpression:exit': validateEngine,
            'ArrowFunctionExpression:exit': validateEngine,
        };
    },
};
