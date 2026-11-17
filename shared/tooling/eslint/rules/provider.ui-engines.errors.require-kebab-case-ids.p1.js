import { isSharedErrorReporterFactory } from '#eslint/helpers/is-shared-error-reporter-factory.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Use statically known kebab-case IDs for shared error reporter calls.',
        includeInReadme: true,
        schema: [],
        messages: {
            id: 'Use a literal kebab-case error ID or a value whose TypeScript type contains only kebab-case string literals: lowercase words separated by single hyphens, with no spaces or underscores. Unrestricted strings are not allowed.',
        },
    },

    create(context) {
        const services = context.sourceCode.parserServices ?? {};
        const checker = services.program?.getTypeChecker();
        const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

        function isValidIdType(type) {
            if (type.isUnion()) return type.types.length > 0 && type.types.every(isValidIdType);
            return type.isStringLiteral() && idPattern.test(type.value);
        }

        function isValidId(argument) {
            if (argument?.type === 'Literal') {
                return typeof argument.value === 'string' && idPattern.test(argument.value);
            }

            const tsNode = argument && services.esTreeNodeToTSNodeMap?.get(argument);
            return Boolean(tsNode && checker && isValidIdType(checker.getTypeAtLocation(tsNode)));
        }

        function isReporter(expression, seen = new Set()) {
            expression = unwrapExpression(expression);
            if (!expression) return false;
            if (expression.type === 'CallExpression') return isSharedErrorReporterFactory(expression.callee, context);
            if (expression.type !== 'Identifier') return false;
            const variable = resolveVariableBinding(expression, context.sourceCode);
            if (!variable || seen.has(variable)) return false;
            seen.add(variable);
            return variable.defs.some(definition => definition.node.type === 'VariableDeclarator'
                && definition.node.id.type === 'Identifier' && isReporter(definition.node.init, seen));
        }

        return {
            CallExpression(node) {
                const callee = unwrapExpression(node.callee);
                let argument;
                if (isReporter(callee)) {
                    argument = node.arguments[0];
                } else if (callee.type === 'MemberExpression' && isReporter(callee.object)) {
                    const method = getStaticPropertyName(callee);
                    if (method === 'call') argument = node.arguments[1];
                    else if (method === 'apply') {
                        const values = unwrapExpression(node.arguments[1]);
                        argument = values?.type === 'ArrayExpression' ? values.elements[0] : null;
                    } else return;
                } else return;

                argument = unwrapExpression(argument);
                if (!isValidId(argument)) {
                    context.report({node: argument ?? node, messageId: 'id'});
                }
            },
        };
    },
};
