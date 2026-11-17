import { getVariableDeclarator } from '#eslint/helpers/get-variable-declarator.js';
import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';
import { unwrapExpression } from '#eslint/helpers/unwrap-expression.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Declare defineProps variables with const.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            kind: 'Declare the defineProps result with const. Review any later reassignment and preserve its intended behavior when rewriting it.',
        },
    },

    create(context) {
        return createVuePropsVisitor(context, {
            defineProps(node) {
                const statement = getVariableDeclarator(node)?.parent;

                if (statement && (statement.type !== 'VariableDeclaration' || statement.kind !== 'const')) {
                    context.report({
                        node: node,
                        messageId: 'kind',
                        fix(fixer) {
                            // Leave var hoisting and multi-binding declarations manual.
                            if (statement.kind !== 'let' || statement.declarations.length !== 1
                                || statement.declarations[0].id.type !== 'Identifier') {
                                return null;
                            }

                            const variables = context.sourceCode.getDeclaredVariables(statement);

                            if (variables.length !== 1 || variables[0].references.some(function (reference) {
                                return reference.isWrite() && !reference.init;
                            })) {
                                return null;
                            }

                            const sourceCode = context.sourceCode;
                            if (sourceCode.getTokens(sourceCode.ast).some((token) => token.value === 'eval')) return null;

                            // Vue's synthetic script references mark template uses
                            // as reads, so inspect the real template reference modes.
                            const pending = sourceCode.ast.templateBody ? [sourceCode.ast.templateBody] : [];
                            for (const current of pending) {
                                if (current.type === 'VAttribute') {
                                    if (!current.directive && current.key.name === 'ref' && current.value?.value === variables[0].name) return null;
                                    const target = unwrapExpression(current.value?.expression);
                                    if (current.directive && current.key.name.name === 'model'
                                        && target?.type === 'Identifier' && target.name === variables[0].name) return null;
                                }
                                if (current.type === 'VExpressionContainer' && current.references.some((reference) =>
                                    reference.id.name === 'eval'
                                    || (reference.id.name === variables[0].name && reference.variable == null && reference.mode !== 'r'))) return null;
                                for (const key of sourceCode.visitorKeys[current.type] ?? []) {
                                    const children = Array.isArray(current[key]) ? current[key] : [current[key]];
                                    pending.push(...children.filter((child) => child?.type));
                                }
                            }

                            return fixer.replaceText(context.sourceCode.getFirstToken(statement), 'const');
                        },
                    });
                }
            },
        });
    },
};
