import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Call registerEventListener only inside named engine registration functions.',
        includeInReadme: true,
        schema: [],
        messages: {
            location: 'Move this registration into registerAllEventListeners() or a named register<Resource>EventListeners() function declared directly inside the engine.',
            reference: 'Call registerEventListener() directly inside a registration function; do not alias, reassign, or pass the helper as a callback.',
        },
    },

    create(context) {
        function validateEngine(engine) {
            if (!isEngineFactory(engine)) return;
            const helpers = engine.body.body.filter(statement => statement.type === 'FunctionDeclaration'
                && statement.id?.name === 'registerEventListener');

            for (const helper of helpers) {
                const binding = context.sourceCode.getDeclaredVariables(helper).find(variable => variable.name === 'registerEventListener'
                    && variable.defs.some(definition => definition.node === helper));
                if (!binding) continue;

                for (const reference of binding.references) {
                    if (reference.isValueReference === false) continue;
                    let expression = reference.identifier;
                    while (unwrap(expression.parent) === reference.identifier) expression = expression.parent;
                    const call = expression.parent;
                    if (!reference.isReadOnly() || call.type !== 'CallExpression' || call.callee !== expression || call.optional) {
                        context.report({node: reference.identifier, messageId: 'reference'});
                        continue;
                    }

                    let enclosing = call.parent;
                    while (enclosing && !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(enclosing.type)) {
                        enclosing = enclosing.parent;
                    }
                    if (enclosing?.type !== 'FunctionDeclaration' || enclosing.async || enclosing.generator
                        || !/^register[A-Z][A-Za-z0-9]*EventListeners$/.test(enclosing.id?.name ?? '')
                        || enclosing.parent !== engine.body) {
                        context.report({node: call, messageId: 'location'});
                    }
                }
            }
        }

        return {
            'FunctionDeclaration:exit': validateEngine,
            'FunctionExpression:exit': validateEngine,
            'ArrowFunctionExpression:exit': validateEngine,
        };
    },
};
