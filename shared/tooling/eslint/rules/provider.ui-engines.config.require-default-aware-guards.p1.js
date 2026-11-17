import ts from 'typescript';
import {isEngineFactory} from '#eslint/helpers/is-engine-factory.js';
import {getDestructuredFields} from '#eslint/helpers/get-destructured-fields.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression'].includes(node.type)) node = node.expression;
    return node;
}

function contains(node, identifier) {
    return node.range[0] <= identifier.range[0] && identifier.range[1] <= node.range[1];
}

export default {
    meta: {
        type: 'suggestion',
        description: 'Match config presence guards to defaults and optional types.',
        includeInReadme: true,
        schema: [],
        messages: {
            optional: 'Guard optional config field "{{name}}" with {{name}} !== undefined && (...) before validating its value.',
            redundant: 'Remove the undefined presence guard for defaulted config field "{{name}}"; validate its value directly.',
        },
    },

    create(context) {
        const source = context.sourceCode;
        const services = source.parserServices;
        if (!services.program || !services.esTreeNodeToTSNodeMap) {
            throw new Error('require-config-default-aware-guards requires TypeScript parserOptions.project.');
        }
        const checker = services.program.getTypeChecker();

        function isUndefined(node) {
            node = unwrap(node);
            if (node?.type !== 'Identifier' || node.name !== 'undefined') return false;
            let scope = source.getScope(node);
            while (scope) {
                const variable = scope.set.get('undefined');
                if (variable) return variable.defs.length === 0;
                scope = scope.upper;
            }
            return true;
        }

        function isPresenceCheck(node, references) {
            node = unwrap(node);
            return node?.type === 'BinaryExpression' && node.operator === '!=='
                && ((references.has(unwrap(node.left)) && isUndefined(node.right))
                    || (references.has(unwrap(node.right)) && isUndefined(node.left)));
        }

        function startsWithPresenceCheck(node, references) {
            node = unwrap(node);
            if (node?.type !== 'LogicalExpression' || node.operator !== '&&') return false;
            return isPresenceCheck(node.left, references) || startsWithPresenceCheck(node.left, references);
        }

        function validateEngine(node) {
            if (!isEngineFactory(node)) return;
            const config = source.getScope(node).set.get('config');
            if (!config) return;
            const reads = new Set(config.references.filter(reference => reference.isRead()).map(reference => reference.identifier));
            const declarations = node.body.body.filter(statement => statement.type === 'VariableDeclaration')
                .flatMap(statement => statement.declarations)
                .filter(declaration => declaration.id.type === 'ObjectPattern' && reads.has(unwrap(declaration.init)));
            if (declarations.length !== 1) return;
            const declaration = declarations[0];
            const validation = node.body.body.find(statement => statement.type === 'FunctionDeclaration' && statement.id?.name === 'validateConfig');
            if (!validation?.body) return;
            const configType = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(declaration.init));
            const variables = source.getDeclaredVariables(declaration);
            const fields = getDestructuredFields(declaration.id).filter(field => field.property.type === 'Property').map(field => {
                const name = field.path.every(part => typeof part === 'string') ? field.path.join('.') : null;
                let type = configType;
                let symbol;
                for (const key of field.path) {
                    symbol = typeof key === 'string' ? checker.getPropertyOfType(checker.getNonNullableType(type), key) : null;
                    if (!symbol) break;
                    type = checker.getTypeOfSymbolAtLocation(symbol, services.esTreeNodeToTSNodeMap.get(declaration.init));
                }
                const bindings = variables.filter(variable => variable.identifiers.some(identifier => contains(field.value, identifier)));
                return {
                    name,
                    defaulted: field.defaulted,
                    optional: Boolean(symbol && (symbol.flags & ts.SymbolFlags.Optional)),
                    references: new Set(bindings.flatMap(variable => variable.references)
                        .filter(reference => reference.isValueReference !== false && reference.isRead())
                        .map(reference => reference.identifier)),
                };
            });

            for (const statement of validation.body.body) {
                if (statement.type !== 'IfStatement') continue;
                const fieldsInGuard = fields.filter(field => [...field.references].some(identifier => contains(statement.test, identifier)));
                // Cross-field relationship checks have a separate ordering contract.
                if (fieldsInGuard.length !== 1) continue;
                const field = fieldsInGuard[0];
                const guarded = startsWithPresenceCheck(statement.test, field.references);
                if (field.defaulted && guarded) {
                    context.report({node: statement.test, messageId: 'redundant', data: {name: field.name}});
                } else if (!field.defaulted && field.optional && !guarded) {
                    context.report({node: statement.test, messageId: 'optional', data: {name: field.name}});
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
