import { getVariableDeclarator } from '#eslint/helpers/get-variable-declarator.js';
import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Assign defineProps directly as a variable initializer.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            initializer: 'Assign the defineProps call directly to a variable. Remove wrappers and intermediate expressions while preserving their intended behavior.',
        },
    },

    create(context) {
        return createVuePropsVisitor(context, {
            defineProps(node) {
                if (!getVariableDeclarator(node)) {
                    context.report({
                        node: node,
                        messageId: 'initializer',
                        fix(fixer) {
                            const statement = node.parent;
                            const sourceCode = context.sourceCode;

                            if (statement.type !== 'ExpressionStatement' || statement.parent.type !== 'Program'
                                || node.callee.type !== 'Identifier') {
                                return null;
                            }

                            const template = sourceCode.ast.templateBody;
                            const templateTokens = template ? sourceCode.parserServices.getTemplateBodyTokenStore().getTokens(template) : [];
                            const tokens = [
                                ...sourceCode.getTokens(sourceCode.ast),
                                ...templateTokens,
                            ];

                            // Avoid capturing existing names or fixing multiple macro calls
                            // into duplicate declarations during the same ESLint pass.
                            if (tokens.some(function (token) { return ['props', 'eval'].includes(token.value); })
                                || templateTokens.some((token) => typeof token.value === 'string' && /^(?:props|Props)(?:\.|$)/u.test(token.value))
                                || tokens.filter(function (token) { return token.value === node.callee.name; }).length !== 1
                                || /\bv-bind\s*\(/u.test(sourceCode.text)) {
                                return null;
                            }

                            return fixer.insertTextBefore(statement, 'const props = ');
                        },
                    });
                }
            },
        });
    },
};
