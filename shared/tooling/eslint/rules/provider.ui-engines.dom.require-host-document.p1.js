import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

function isHostGlobal(name) {
    return name === 'document' || name === 'window';
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Use the host element’s document and window instead of browser globals.',
        includeInReadme: true,
        schema: [],
        messages: {
            host: 'Use the host element\'s ownerDocument or its defaultView instead of global {{name}}.',
        },
    },

    create(context) {
        const source = context.sourceCode;
        const reported = new Set();

        function report(node, name) {
            if (reported.has(node)) return;
            reported.add(node);
            context.report({node, messageId: 'host', data: {name}});
        }

        function validateEngine(engine) {
            if (!isEngineFactory(engine)) return;
            for (const scope of source.scopeManager.scopes) {
                for (const reference of scope.references) {
                    const identifier = reference.identifier;
                    if (reference.isValueReference === false || reference.resolved?.defs.length
                        || identifier.range[0] <= engine.body.range[0] || identifier.range[1] >= engine.body.range[1]) continue;
                    if (isHostGlobal(identifier.name)) {
                        report(identifier, identifier.name);
                        continue;
                    }
                    if (!['globalThis', 'self'].includes(identifier.name)) continue;
                    let expression = identifier;
                    while (unwrap(expression.parent) === identifier) expression = expression.parent;
                    const parent = expression.parent;
                    if (parent.type === 'MemberExpression' && parent.object === expression) {
                        const name = parent.computed ? parent.property.type === 'Literal' ? parent.property.value : null : parent.property.name;
                        if (isHostGlobal(name)) report(parent, name);
                    }
                    const pattern = parent.type === 'VariableDeclarator' && parent.init === expression ? parent.id
                        : parent.type === 'AssignmentExpression' && parent.right === expression ? parent.left : null;
                    if (pattern?.type !== 'ObjectPattern') continue;
                    for (const property of pattern.properties) {
                        if (property.type !== 'Property') continue;
                        const name = property.computed ? property.key.value : property.key.name ?? property.key.value;
                        if (isHostGlobal(name)) report(property, name);
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
