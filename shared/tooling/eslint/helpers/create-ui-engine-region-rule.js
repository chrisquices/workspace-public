import {isEngineFactory} from './is-engine-factory.js';

export default function createUiEngineRegionRule({
    name,
    after,
    index,
    last = false,
    methods = [],
    constants = [],
    orderedMethods = false,
    exclusiveMethods = false,
    validateContents,
}) {
    const placement = last ? 'last, before the final init(); and returned handle'
        : `immediately after ${after}, as engine region ${index + 1}`;

    return {
        meta: {
            type: 'suggestion',
            docs: {description: `Require exactly one ${name} region ${placement}.`},
            schema: [],
            messages: {
                structure: `Place exactly one ${name} region ${placement}.`,
                closing: `Close the ${name} region with an endregion marker before the end of the engine.`,
                ...(methods.length ? {method: `Declare exactly one function {{method}}() inside the ${name} region.`} : {}),
                ...(constants.length ? {constant: `Declare exactly one const {{constant}} inside the ${name} region.`} : {}),
                ...(orderedMethods ? {methodOrder: `Declare the ${name} functions in this order: ${methods.map(method => `${method}()`).join(', ')}.`} : {}),
                ...(exclusiveMethods ? {extraMethod: `Move {{method}}() outside the ${name} region. Only ${methods.map(method => `${method}()`).join(', ')} are allowed here.`} : {}),
            },
        },

        create(context) {
            const source = context.sourceCode;

            function validateEngine(node) {
                if (!isEngineFactory(node)) return;
                const statements = node.body.body;
                const comments = source.getAllComments().filter(comment => comment.type === 'Line'
                    && comment.range[0] > node.body.range[0] && comment.range[1] < node.body.range[1]
                    && !statements.some(statement => statement.range[0] <= comment.range[0] && comment.range[1] <= statement.range[1]));
                const regions = [];
                const stack = [];

                for (const comment of comments) {
                    if (/^\s*region\b/.test(comment.value)) {
                        const title = comment.value.replace(/^\s*region\s*/, '')
                            .replace(/^[-=]+\s*/, '').replace(/\s*[-=]+\s*$/, '').trim();
                        const region = {name: title, opening: comment, closing: null, depth: stack.length};
                        regions.push(region);
                        stack.push(region);
                    } else if (/^\s*endregion\b/.test(comment.value)) {
                        const region = stack.pop();
                        if (region) region.closing = comment;
                    }
                }

                const outerRegions = regions.filter(region => region.depth === 0);
                const matches = outerRegions.filter(region => region.name === name);

                if (matches.length !== 1) {
                    context.report({node: matches[0]?.opening ?? node, messageId: 'structure'});
                    return;
                }

                const region = matches[0];
                const previous = outerRegions[index - 1];
                const hasExpectedPosition = last ? outerRegions.at(-1) === region
                    : previous?.name === after && outerRegions[index] === region && previous.closing
                        && !statements.some(statement => statement.range[0] > previous.closing.range[1]
                            && statement.range[0] < region.opening.range[0]);

                if (!hasExpectedPosition) {
                    context.report({node: region.opening, messageId: 'structure'});
                }

                if (!region.closing) {
                    context.report({node: region.opening, messageId: 'closing'});
                    return;
                }

                if (last && hasExpectedPosition) {
                    const tail = statements.filter(statement => statement.range[0] > region.closing.range[1]);
                    const call = tail[0]?.type === 'ExpressionStatement' ? tail[0].expression : null;

                    if (tail.length !== 2 || call?.type !== 'CallExpression' || call.optional
                        || call.callee.type !== 'Identifier' || call.callee.name !== 'init' || call.arguments.length !== 0
                        || tail[1]?.type !== 'ReturnStatement' || tail[1].argument?.type !== 'ObjectExpression') {
                        context.report({node: region.opening, messageId: 'structure'});
                    }
                }

                const contents = statements.filter(statement => statement.range[0] > region.opening.range[1]
                    && statement.range[1] < region.closing.range[0]);
                validateContents?.(context, contents, region, node);
                const functions = contents.filter(statement => statement.type === 'FunctionDeclaration'
                    && statement.body?.type === 'BlockStatement');
                let hasAllMethods = true;

                for (const method of methods) {
                    const matches = functions.filter(statement => statement.id?.name === method);

                    if (matches.length !== 1) {
                        hasAllMethods = false;
                        context.report({node: region.opening, messageId: 'method', data: {method}});
                    }
                }

                if (orderedMethods && hasAllMethods) {
                    const actual = functions.filter(statement => methods.includes(statement.id?.name))
                        .map(statement => statement.id.name);

                    if (actual.some((method, position) => method !== methods[position])) {
                        context.report({node: region.opening, messageId: 'methodOrder'});
                    }
                }

                if (exclusiveMethods) {
                    for (const declaration of functions) {
                        if (!methods.includes(declaration.id?.name)) {
                            context.report({node: declaration, messageId: 'extraMethod', data: {method: declaration.id.name}});
                        }
                    }

                    for (const statement of contents) {
                        if (statement.type !== 'VariableDeclaration') continue;

                        for (const declaration of statement.declarations) {
                            let value = declaration.init;

                            while (value && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(value.type)) {
                                value = value.expression;
                            }

                            if (['FunctionExpression', 'ArrowFunctionExpression'].includes(value?.type)
                                && !methods.includes(declaration.id.name)) {
                                context.report({node: declaration, messageId: 'extraMethod', data: {method: declaration.id.name ?? 'This function'}});
                            }
                        }
                    }
                }

                const declarations = contents.filter(statement => statement.type === 'VariableDeclaration'
                    && statement.kind === 'const').flatMap(statement => statement.declarations);

                for (const constant of constants) {
                    if (declarations.filter(declaration => declaration.id.type === 'Identifier'
                        && declaration.id.name === constant).length !== 1) {
                        context.report({node: region.opening, messageId: 'constant', data: {constant}});
                    }
                }
            }

            return {
                FunctionDeclaration: validateEngine,
                FunctionExpression: validateEngine,
                ArrowFunctionExpression: validateEngine,
            };
        },
    };
}
