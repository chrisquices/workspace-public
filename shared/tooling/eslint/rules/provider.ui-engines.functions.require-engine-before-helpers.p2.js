import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Place exported UI engine factories before module-level helpers.',
        includeInReadme: true,
        schema: [],
        messages: {
            order: 'Move module-level helper "{{name}}" below the exported engine function declarations. Keep function ordering inside each engine unchanged.',
        },
    },

    create(context) {
        return {
            Program(node) {
                const functions = [];

                for (const statement of node.body) {
                    const declaration = ['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(statement.type)
                        ? statement.declaration : statement;
                    if (!declaration) continue;

                    if (['FunctionDeclaration', 'TSDeclareFunction'].includes(declaration.type)) {
                        functions.push({node: declaration, name: declaration.id?.name ?? 'default'});
                    } else if (declaration.type === 'VariableDeclaration') {
                        for (const variable of declaration.declarations) {
                            if (variable.id.type === 'Identifier' && ['FunctionExpression', 'ArrowFunctionExpression'].includes(variable.init?.type)) {
                                functions.push({node: variable.init, name: variable.id.name});
                            }
                        }
                    }
                }

                const engines = functions.filter(entry => isEngineFactory(entry.node));
                if (!engines.length) return;

                const lastEngine = engines.at(-1).node;
                const engineNames = new Set(engines.map(entry => entry.name));
                for (const entry of functions) {
                    if (isEngineFactory(entry.node) || entry.node.range[0] > lastEngine.range[0]) continue;
                    if (entry.node.type === 'TSDeclareFunction' && engineNames.has(entry.name)) continue;

                    context.report({node: entry.node.id ?? entry.node, messageId: 'order', data: {name: entry.name}});
                }
            },
        };
    },
};
