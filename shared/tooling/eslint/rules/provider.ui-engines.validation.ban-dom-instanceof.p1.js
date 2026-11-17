import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

const domConstructors = new Set([
    'Node', 'Element', 'HTMLElement', 'SVGElement', 'MathMLElement',
    'Document', 'HTMLDocument', 'XMLDocument', 'DocumentFragment', 'ShadowRoot',
    'DocumentType', 'CharacterData', 'Text', 'Comment', 'CDATASection',
    'ProcessingInstruction', 'Attr', 'Window', 'EventTarget', 'NodeList',
    'HTMLCollection', 'NamedNodeMap', 'DOMTokenList', 'DOMStringMap',
]);

function isDomName(name) {
    return domConstructors.has(name) || /^(?:HTML|SVG|MathML)[A-Z].*Element$/.test(name ?? '');
}

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Validate required DOM capabilities instead of DOM constructor instanceof checks.',
        includeInReadme: true,
        schema: [],
        messages: {
            capability: 'Validate DOM capabilities instead of using instanceof {{name}}. Check the methods and properties this engine requires.',
        },
    },

    create(context) {
        function getDomConstructor(expression, seen = new Set()) {
            expression = unwrap(expression);
            if (!expression) return null;
            if (expression.type === 'MemberExpression') {
                const name = expression.computed
                    ? expression.property.type === 'Literal' ? expression.property.value : null
                    : expression.property.name;
                return isDomName(name) ? name : null;
            }
            if (expression.type !== 'Identifier') return null;

            let scope = context.sourceCode.getScope(expression);
            let variable;
            while (scope && !variable) {
                variable = scope.set.get(expression.name);
                scope = scope.upper;
            }
            // Local classes with DOM-like names are not browser constructors.
            if (!variable || variable.defs.length === 0) return isDomName(expression.name) ? expression.name : null;
            if (seen.has(variable)) return null;
            seen.add(variable);
            if (variable.defs.length !== 1) return null;
            const definition = variable.defs[0];
            if (definition.node.type !== 'VariableDeclarator' || definition.node.id.type !== 'Identifier'
                || definition.parent?.kind !== 'const') return null;
            return getDomConstructor(definition.node.init, seen);
        }

        return {
            BinaryExpression(node) {
                if (node.operator !== 'instanceof') return;
                let validation = node.parent;
                while (validation) {
                    if (validation.type === 'FunctionDeclaration'
                        && ['validateOptions', 'validateConfig'].includes(validation.id?.name)) {
                        const engine = validation.parent?.parent;
                        if (engine && isEngineFactory(engine) && validation.parent === engine.body) break;
                    }
                    validation = validation.parent;
                }
                if (!validation) return;
                const name = getDomConstructor(node.right);
                if (name) context.report({node, messageId: 'capability', data: {name}});
            },
        };
    },
};
