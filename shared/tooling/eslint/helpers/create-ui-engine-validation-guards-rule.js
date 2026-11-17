import {isEngineFactory} from './is-engine-factory.js';
import {getDestructuredFields} from './get-destructured-fields.js';

function unwrap(node) {
    while (node && ['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(node.type)) node = node.expression;
    return node;
}

function contains(node, identifier) {
    return node.range[0] <= identifier.range[0] && identifier.range[1] <= node.range[1];
}

function getMessagePrefix(node) {
    node = unwrap(node);
    if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
    if (node?.type === 'TemplateLiteral') return node.quasis[0].value.cooked ?? '';
    if (node?.type === 'BinaryExpression' && node.operator === '+') return getMessagePrefix(node.left);
    return '';
}

export function createUiEngineValidationGuardsRule(objectName, validationName, useRawProperties = false, requireFieldPrefix = false) {
    return {
        meta: {
            type: 'suggestion',
            docs: {description: `Require dedicated throwing ${objectName} guards before cross-field guards.`},
            schema: [],
            messages: {
                missing: `Validate ${objectName} field "{{name}}" in its own direct if guard inside ${validationName}(), with a direct throw. Do not combine different fields in that individual guard.`,
                order: `Place cross-field guards after all ${objectName} fields have individual throwing guards. Still missing: {{names}}.`,
                throw: `This ${objectName} guard must throw directly when its condition is true.`,
                validation: `Declare ${validationName}() directly inside the engine to validate its ${objectName} fields.`,
                rest: `Destructure ${objectName} fields explicitly so each field can have its own validation guard; use static property names and no rest binding.`,
                prefix: 'Start this validation error message with "{{name}} " using the config property name, followed by the expected input.',
            },
        },

        create(context) {
            const source = context.sourceCode;

            function validateEngine(node) {
                if (!isEngineFactory(node)) return;
                const input = source.getScope(node).set.get(objectName);
                if (!input) return;
                const reads = new Set(input.references.filter(reference => reference.isValueReference !== false && reference.isRead())
                    .map(reference => reference.identifier));
                const declarations = node.body.body.filter(statement => statement.type === 'VariableDeclaration')
                    .flatMap(statement => statement.declarations)
                    .filter(declaration => declaration.id.type === 'ObjectPattern' && reads.has(unwrap(declaration.init)));
                if (declarations.length !== 1) return;

                const declaration = declarations[0];
                const variables = source.getDeclaredVariables(declaration);
                const fields = [];
                for (const field of getDestructuredFields(declaration.id)) {
                    const {property, path, value} = field;
                    if (property.type === 'RestElement') {
                        context.report({node: property, messageId: 'rest'});
                        continue;
                    }
                    const bindings = variables.filter(variable => variable.identifiers.some(identifier => contains(value, identifier)));
                    const name = path.every(part => typeof part === 'string') ? path.join('.') : null;
                    if ((useRawProperties || requireFieldPrefix) && name === null) {
                        context.report({node: property, messageId: 'rest'});
                        continue;
                    }
                    const rawReferences = [...reads].filter(identifier => {
                        let expression = identifier;
                        while (unwrap(expression.parent) === identifier) expression = expression.parent;
                        const member = expression.parent;
                        if (member.type !== 'MemberExpression' || member.object !== expression) return false;
                        return member.computed ? member.property.type === 'Literal' && String(member.property.value) === name
                            : member.property.name === name;
                    });
                    fields.push({
                        node: property,
                        name: name ?? source.getText(property.key),
                        propertyName: name,
                        references: useRawProperties ? rawReferences : bindings.flatMap(variable => variable.references)
                            .filter(reference => reference.isValueReference !== false && reference.isRead())
                            .map(reference => reference.identifier),
                    });
                }

                const validation = node.body.body.find(statement => statement.type === 'FunctionDeclaration'
                    && statement.id?.name === validationName && statement.body);
                if (!validation) {
                    context.report({node: declaration, messageId: 'validation'});
                    return;
                }

                const validated = new Set();
                for (const statement of validation.body.body) {
                    if (statement.type !== 'IfStatement') continue;
                    const mentioned = fields.filter(field => field.references.some(identifier => contains(statement.test, identifier)));
                    if (mentioned.length === 0) continue;
                    // Nested throws do not establish an unconditional throwing guard.
                    const consequent = statement.consequent;
                    const throws = consequent.type === 'ThrowStatement'
                        || (consequent.type === 'BlockStatement' && consequent.body[0]?.type === 'ThrowStatement');
                    if (!throws) {
                        context.report({node: statement, messageId: 'throw'});
                        continue;
                    }
                    if (mentioned.length === 1) {
                        validated.add(mentioned[0]);
                        if (requireFieldPrefix) {
                            const thrown = consequent.type === 'ThrowStatement' ? consequent : consequent.body[0];
                            const error = unwrap(thrown.argument);
                            let message;
                            if (error?.type === 'NewExpression' || error?.type === 'CallExpression') {
                                const callee = unwrap(error.callee);
                                const name = callee.type === 'Identifier' ? callee.name
                                    : callee.type === 'MemberExpression' ? callee.computed ? callee.property.value : callee.property.name : null;
                                message = error.arguments[name === 'AggregateError' ? 1 : 0];
                            }
                            const name = mentioned[0].propertyName;
                            if (!getMessagePrefix(message).startsWith(`${name} `)) {
                                context.report({node: message ?? thrown, messageId: 'prefix', data: {name}});
                            }
                        }
                    } else {
                        const missing = fields.filter(field => !validated.has(field));
                        if (missing.length > 0) context.report({node: statement, messageId: 'order', data: {names: missing.map(field => field.name).join(', ')}});
                    }
                }

                for (const field of fields) {
                    if (!validated.has(field)) context.report({node: field.node, messageId: 'missing', data: {name: field.name}});
                }
            }

            return {
                'FunctionDeclaration:exit': validateEngine,
                'FunctionExpression:exit': validateEngine,
                'ArrowFunctionExpression:exit': validateEngine,
            };
        },
    };
}
