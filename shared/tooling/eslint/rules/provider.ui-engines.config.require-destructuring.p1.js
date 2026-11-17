import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) {
        node = node.expression;
    }
    return node;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Destructure config once directly inside each UI engine, with defaults in that declaration.',
        includeInReadme: true,
        schema: [],
        messages: {
            declaration: 'Destructure config in exactly one declaration directly inside the engine, placing option defaults in that pattern.',
            access: 'Read config options through the single destructuring declaration. Move this access and any option default into that pattern.',
        },
    },

    create(context) {
        function validateEngine(node) {
            if (!isEngineFactory(node)) return;

            const variable = context.sourceCode.getScope(node).set.get('config');
            if (!variable) {
                context.report({node, messageId: 'declaration'});
                return;
            }

            const references = variable.references.filter(reference => reference.isValueReference !== false && reference.isRead());
            const identifiers = new Set(references.map(reference => reference.identifier));
            const declarations = node.body.body
                .filter(statement => statement.type === 'VariableDeclaration')
                .flatMap(statement => statement.declarations)
                .filter(declaration => declaration.id.type === 'ObjectPattern' && identifiers.has(unwrap(declaration.init)));

            if (declarations.length !== 1) {
                context.report({node, messageId: 'declaration'});
            }

            for (const reference of references) {
                let expression = reference.identifier;
                while (unwrap(expression.parent) === reference.identifier) expression = expression.parent;
                const parent = expression.parent;

                if (declarations.some(declaration => declaration.init === expression)) continue;

                // Raw shape checks remain valid before reading individual options.
                if (parent.type === 'UnaryExpression' && ['!', 'typeof'].includes(parent.operator)) continue;
                if (parent.type === 'CallExpression' && parent.arguments.length === 1
                    && parent.arguments[0] === expression && parent.callee.type === 'MemberExpression'
                    && !parent.callee.computed && parent.callee.object.type === 'Identifier'
                    && parent.callee.object.name === 'Array' && parent.callee.property.name === 'isArray') continue;

                context.report({node: expression, messageId: 'access'});
            }
        }

        return {
            'FunctionDeclaration:exit': validateEngine,
            'FunctionExpression:exit': validateEngine,
            'ArrowFunctionExpression:exit': validateEngine,
        };
    },
};
