import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

function memberName(node) {
    node = unwrap(node);
    if (node?.type !== 'MemberExpression') return null;
    return node.computed ? node.property.type === 'Literal' ? node.property.value : null : node.property.name;
}

function callOf(statement) {
    const expression = statement?.type === 'ExpressionStatement' ? unwrap(statement.expression) : null;
    return expression?.type === 'CallExpression' && !expression.optional ? expression : null;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Record matching cleanup immediately after listener registration.',
        includeInReadme: true,
        schema: [],
        messages: {
            cleanup: 'Immediately record matching listener removal in cleanups.push(function() { ... }) or push a named zero-argument cleanup function declared inside registerEventListener(). Use the same target, event, handler, and capture setting.',
        },
    },

    create(context) {
        const source = context.sourceCode;
        function binding(identifier) {
            let scope = source.getScope(identifier);
            while (scope) {
                const variable = scope.set.get(identifier.name);
                if (variable) return variable;
                scope = scope.upper;
            }
            return null;
        }

        function same(left, right) {
            left = unwrap(left);
            right = unwrap(right);
            if (!left || !right || left.type !== right.type) return false;
            if (left.type === 'Identifier') return left.name === right.name && binding(left) === binding(right);
            if (left.type === 'Literal') return left.value === right.value;
            if (left.type === 'MemberExpression') {
                return left.optional === right.optional && same(left.object, right.object)
                    && ((memberName(left) !== null && memberName(left) === memberName(right))
                        || (left.computed && right.computed && same(left.property, right.property)));
            }
            return false;
        }

        function capture(option) {
            option = unwrap(option);
            if (!option || (option.type === 'Literal' && (option.value === false || option.value === null))
                || (option.type === 'Identifier' && option.name === 'undefined' && !binding(option)?.defs.length)) return false;
            if (option.type === 'Literal' && option.value === true) return true;
            if (option.type !== 'ObjectExpression') return option;
            // Spreads and computed properties can override capture dynamically.
            if (option.properties.some(property => property.type !== 'Property' || property.computed)) return option;
            const property = option.properties.filter(property => (property.key.name ?? property.key.value) === 'capture').at(-1);
            if (!property) return false;
            if (property.kind !== 'init' || property.method) return option;
            return capture(property.value);
        }

        function matches(add, remove) {
            if (!remove || memberName(remove.callee) !== 'removeEventListener' || remove.callee.optional
                || add.arguments.length < 2 || remove.arguments.length < 2) return false;
            const addedCapture = capture(add.arguments[2]);
            const removedCapture = capture(remove.arguments[2]);
            return same(add.callee.object, remove.callee.object)
                && same(add.arguments[0], remove.arguments[0]) && same(add.arguments[1], remove.arguments[1])
                && (addedCapture === removedCapture || (typeof addedCapture === 'object' && typeof removedCapture === 'object'
                    && same(addedCapture, removedCapture)));
        }

        return {
            CallExpression(node) {
                if (memberName(node.callee) !== 'addEventListener') return;
                let helper = node.parent;
                while (helper && !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(helper.type)) helper = helper.parent;
                const engine = helper?.parent?.parent;
                if (helper?.type !== 'FunctionDeclaration' || helper.id?.name !== 'registerEventListener'
                    || !engine || !isEngineFactory(engine) || helper.parent !== engine.body) return;

                const statements = helper.body.body;
                const index = statements.findIndex(statement => callOf(statement) === node);
                const push = index < 0 ? null : callOf(statements[index + 1]);
                const argument = unwrap(push?.arguments[0]);
                const variable = argument?.type === 'Identifier' ? binding(argument) : null;
                const callback = variable && !variable.references.some(reference => reference.isWrite())
                    ? variable.defs.find(definition => definition.node.type === 'FunctionDeclaration'
                        && definition.node.parent === helper.body)?.node
                    : argument;
                const cleanupBinding = source.getScope(engine).set.get('cleanups');
                const validPush = push && memberName(push.callee) === 'push' && !push.callee.optional
                    && push.callee.object.type === 'Identifier' && push.callee.object.name === 'cleanups'
                    && cleanupBinding && binding(push.callee.object) === cleanupBinding && push.arguments.length === 1;
                const validCallback = ['FunctionExpression', 'FunctionDeclaration'].includes(callback?.type) && !callback.async && !callback.generator
                    && callback.params.length === 0 && callback.body.body.length === 1;
                if (node.optional || node.callee.optional || !validPush || !validCallback
                    || !matches(node, callOf(callback.body.body[0]))) {
                    context.report({node, messageId: 'cleanup'});
                }
            },
        };
    },
};
