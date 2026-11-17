// Use one object descriptor with messageId in each context.report call.
// Declare every possible ID in meta.messages. Literal IDs, constant aliases, and
// conditional choices between known IDs keep reports statically identifiable.
// Keep node or loc, data, and fix information in the descriptor.
// Write message text for agents. Identify the violation, describe the expected
// result, and give a concrete corrective action with relevant preservation details.

import { getUnreassignedVariableInitializer } from '#eslint/helpers/get-unreassigned-variable-initializer.js';
import { resolveVariableBinding } from '#eslint/helpers/resolve-variable-binding.js';
import { getStaticPropertyName } from '#eslint/helpers/get-static-property-name.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Use declared message IDs in ESLint rule reports.',
        includeInReadme: true,
        schema: [],
        messages: {
            descriptor: 'Report with one object descriptor containing messageId. Move inline message text into meta.messages and reference its key. Keep node or loc, data, and fix information in the descriptor.',
            staticId: 'Use a nonempty, statically identifiable messageId. Literal IDs, constant aliases, and conditional choices between known IDs are supported. Declare every possible ID in meta.messages.',
            unknownId: 'Declare these message IDs in this rule\'s meta.messages or correct the report to use existing keys. Undeclared IDs are {{ids}}.',
        },
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const unknown = Symbol('unknown report property');

        function isCreateParameter(definition) {
            const owner = definition.node.parent;

            return definition.type === 'Parameter' && owner?.type === 'Property' && getStaticPropertyName(owner) === 'create';
        }

        function isContext(expression, seen = new Set()) {
            const node = unwrapExpression(expression);

            if (node?.type !== 'Identifier') {
                return false;
            }

            const variable = resolveVariableBinding(node, sourceCode);

            if (variable?.defs.some(function (definition) {
                const parameter = definition.node.params?.[0];
                const binding = parameter?.type === 'AssignmentPattern' ? parameter.left : parameter;

                return isCreateParameter(definition) && binding === definition.name;
            })) {
                return true;
            }

            const constant = getUnreassignedVariableInitializer(node, sourceCode);

            return Boolean(constant && !seen.has(constant.variable)
                && isContext(constant.expression, new Set([...seen, constant.variable])));
        }

        function isReport(expression, seen = new Set()) {
            const node = unwrapExpression(expression);

            if (node?.type === 'MemberExpression') {
                return getStaticPropertyName(node) === 'report' && isContext(node.object);
            }

            if (node?.type !== 'Identifier') {
                return false;
            }

            const variable = resolveVariableBinding(node, sourceCode);
            const destructured = variable?.defs.some(function (definition) {
                const pattern = isCreateParameter(definition) ? definition.node.params[0] : definition.node.id;

                return pattern?.type === 'ObjectPattern' && pattern.properties.some(function (property) {
                    return property.type === 'Property' && getStaticPropertyName(property) === 'report' && property.value === definition.name;
                }) && (isCreateParameter(definition) || isContext(definition.node.init));
            });

            if (destructured) {
                return true;
            }

            const constant = getUnreassignedVariableInitializer(node, sourceCode);

            return Boolean(constant && !seen.has(constant.variable)
                && isReport(constant.expression, new Set([...seen, constant.variable])));
        }

        function resolve(expression) {
            let node = unwrapExpression(expression);
            const seen = new Set();

            while (node?.type === 'Identifier') {
                const constant = getUnreassignedVariableInitializer(node, sourceCode);

                if (!constant || seen.has(constant.variable)) {
                    return null;
                }

                seen.add(constant.variable);
                node = unwrapExpression(constant.expression);
            }

            return node;
        }

        function reportProperty(expression, name, seen = new Set()) {
            const node = resolve(expression);

            if (node?.type !== 'ObjectExpression' || seen.has(node)) {
                return unknown;
            }

            for (const property of node.properties.toReversed()) {
                if (property.type === 'SpreadElement') {
                    const value = reportProperty(property.argument, name, new Set([...seen, node]));

                    if (value !== undefined) {
                        return value;
                    }
                } else {
                    const key = getStaticPropertyName(property);

                    if (key === null) {
                        return unknown;
                    }

                    if (key === name) {
                        return property.kind === 'init' ? property.value : unknown;
                    }
                }
            }

            return undefined;
        }

        function messageIds(expression) {
            const node = resolve(expression);

            if (node?.type === 'Literal' && typeof node.value === 'string') {
                return [node.value];
            }

            if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
                return [node.quasis[0].value.cooked];
            }

            if (node?.type === 'ConditionalExpression') {
                const consequent = messageIds(node.consequent);
                const alternate = messageIds(node.alternate);

                return consequent && alternate ? [...consequent, ...alternate] : null;
            }

            return null;
        }

        return {
            CallExpression(node) {
                if (!isReport(node.callee)) {
                    return;
                }

                const id = reportProperty(node.arguments[0], 'messageId');
                const message = reportProperty(node.arguments[0], 'message');

                if (node.arguments.length !== 1 || message !== undefined || id === undefined || id === unknown) {
                    context.report({ node: node, messageId: 'descriptor' });
                    return;
                }

                const ids = messageIds(id);

                if (!ids || ids.some(function (value) { return !value?.trim(); })) {
                    context.report({ node: node, messageId: 'staticId' });
                    return;
                }

                const metadata = context.settings.workspaceRuleMetadata?.[context.filename];
                const missing = metadata && ids.filter(function (value) { return !metadata.messageIds.includes(value); });

                if (missing?.length) {
                    context.report({ node: node, messageId: 'unknownId', data: { ids: [...new Set(missing)].join(', ') } });
                }
            },
        };
    },
};
