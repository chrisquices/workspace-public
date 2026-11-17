import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

function isCall(statement, name) {
    const call = statement?.type === 'ExpressionStatement' ? statement.expression : null;
    return call?.type === 'CallExpression' && !call.optional && call.arguments.length === 0
        && call.callee.type === 'Identifier' && call.callee.name === name;
}

function isDestructuring(statement, name) {
    if (statement?.type !== 'VariableDeclaration' || !['const', 'let'].includes(statement.kind) || statement.declarations.length !== 1) return false;
    if (name === 'options' && statement.kind !== 'const') return false;
    const declaration = statement.declarations[0];
    if (declaration.id.type !== 'ObjectPattern' || declaration.init?.type !== 'Identifier' || declaration.init.name !== name) return false;
    if (name !== 'options') return true;

    const properties = declaration.id.properties;
    return properties.length === 2 && ['element', 'config'].every(key => properties.some(property => property.type === 'Property'
        && !property.computed && (property.key.type === 'Identifier' ? property.key.name : property.key.value) === key));
}

function isFunction(statement, name) {
    const parameters = statement?.params;
    const validParameters = parameters?.length === 0 || name === 'validateConfig'
        && parameters?.length === 1 && parameters[0].type === 'Identifier' && parameters[0].optional === true;
    return statement?.type === 'FunctionDeclaration' && statement.id?.name === name
        && statement.body?.type === 'BlockStatement' && validParameters
        && !statement.async && !statement.generator;
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Put Configuration first, with validation and destructuring statements in the required order.',
        includeInReadme: true,
        schema: [],
        messages: {
            first: 'Place exactly one Configuration region as the first content inside the engine.',
            structure: 'Configuration must contain only validateOptions();, const destructuring of only element and config from options, const or let destructuring of config, validateConfig();, function validateOptions() {}, and function validateConfig() {}, in that order. validateConfig may accept one optional update parameter. Close the region after those declarations.',
            spacing: 'Use {{count}} blank line(s) {{position}}; do not insert other comments or content in that gap.',
        },
    },

    create(context) {
        const source = context.sourceCode;

        function checkGap(left, right, count, position) {
            const gap = source.text.slice(left.range[1], right.range[0]);
            if (!/^\s*$/.test(gap) || right.loc.start.line - left.loc.end.line !== count + 1) {
                context.report({node: right, messageId: 'spacing', data: {count, position}});
            }
        }

        function validateEngine(node) {
            if (!isEngineFactory(node)) return;
            const statements = node.body.body;
            const comments = source.getAllComments().filter(comment => comment.type === 'Line'
                && comment.range[0] > node.body.range[0] && comment.range[1] < node.body.range[1]
                && !statements.some(statement => statement.range[0] <= comment.range[0] && comment.range[1] <= statement.range[1]));
            const configurations = comments.filter(comment => /^\s*region\s+[-=]+\s+Configuration\s+[-=]+\s*$/.test(comment.value));
            const opening = configurations[0];
            const first = source.getTokenAfter(source.getFirstToken(node.body), {includeComments: true});
            if (configurations.length !== 1 || first !== opening) {
                context.report({node: opening ?? node, messageId: 'first'});
            }
            if (!opening) return;

            // Another region marker before the closing marker is not part of this fixed layout.
            const closing = comments.find(comment => comment.range[0] > opening.range[1] && /^\s*(?:end)?region\b/.test(comment.value));
            if (!closing || !/^\s*endregion\b/.test(closing.value)) {
                context.report({node: opening, messageId: 'structure'});
                return;
            }
            const contents = statements.filter(statement => statement.range[0] > opening.range[1] && statement.range[0] < closing.range[0]);
            const valid = contents.length === 6 && contents.every(statement => statement.range[1] < closing.range[0])
                && isCall(contents[0], 'validateOptions')
                && isDestructuring(contents[1], 'options')
                && isDestructuring(contents[2], 'config')
                && isCall(contents[3], 'validateConfig')
                && isFunction(contents[4], 'validateOptions')
                && isFunction(contents[5], 'validateConfig');
            if (!valid) {
                context.report({node: opening, messageId: 'structure'});
                return;
            }

            checkGap(opening, contents[0], 0, 'after the Configuration marker');
            checkGap(contents[0], contents[1], 1, 'after validateOptions()');
            checkGap(contents[1], contents[2], 0, 'between the destructuring declarations');
            checkGap(contents[2], contents[3], 1, 'before validateConfig()');
            checkGap(contents[3], contents[4], 1, 'before function validateOptions()');
            checkGap(contents[4], contents[5], 1, 'between the validation function declarations');
            checkGap(contents[5], closing, 1, 'before the closing region marker');
        }

        return {
            FunctionDeclaration: validateEngine,
            FunctionExpression: validateEngine,
            ArrowFunctionExpression: validateEngine,
        };
    },
};
