import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Register event listeners through the engine tracking helper.',
        includeInReadme: true,
        schema: [],
        messages: {
            tracked: 'Register this listener through registerEventListener(). Direct addEventListener() calls belong only inside the engine\'s registerEventListener() helper.',
        },
    },

    create(context) {
        function isRegistration(callee) {
            callee = unwrap(callee);
            if (callee.type === 'MemberExpression') {
                return callee.computed
                    ? callee.property.type === 'Literal' && callee.property.value === 'addEventListener'
                    : callee.property.name === 'addEventListener';
            }
            if (callee.type !== 'Identifier' || callee.name !== 'addEventListener') return false;
            let scope = context.sourceCode.getScope(callee);
            while (scope) {
                const binding = scope.set.get('addEventListener');
                if (binding) return binding.defs.length === 0;
                scope = scope.upper;
            }
            return true;
        }

        return {
            CallExpression(node) {
                if (!isRegistration(node.callee)) return;
                let enclosing = node.parent;
                while (enclosing && !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(enclosing.type)) {
                    enclosing = enclosing.parent;
                }
                const engine = enclosing?.parent?.parent;
                const allowed = enclosing?.type === 'FunctionDeclaration' && enclosing.id?.name === 'registerEventListener'
                    && engine && isEngineFactory(engine) && enclosing.parent === engine.body;
                if (!allowed) context.report({node, messageId: 'tracked'});
            },
        };
    },
};
