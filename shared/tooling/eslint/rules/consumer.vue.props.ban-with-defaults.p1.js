import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';
import { getVuePropsMacroName } from '#eslint/helpers/get-vue-props-macro-name.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Use direct defineProps declarations instead of withDefaults.',
        includeInReadme: true,
        fixable: 'code',
        schema: [],
        messages: {
            defaults: 'Remove withDefaults and use a direct defineProps declaration. Review existing defaults and callers to preserve intended behavior during the rewrite.',
        },
    },

    create(context) {
        return createVuePropsVisitor(context, {
            withDefaults(node) {
                context.report({
                    node: node,
                    messageId: 'defaults',
                    fix(fixer) {
                        const [props, defaults] = node.arguments;
                        const sourceCode = context.sourceCode;

                        if (node.arguments.length !== 2 || props?.type !== 'CallExpression'
                            || getVuePropsMacroName(props.callee, sourceCode) !== 'defineProps'
                            || defaults?.type !== 'ObjectExpression' || defaults.properties.length !== 0
                            || sourceCode.getCommentsInside(node).some(function (comment) {
                                return comment.range[0] < props.range[0] || comment.range[1] > props.range[1];
                            })) {
                            return null;
                        }

                        return fixer.replaceText(node, sourceCode.getText(props));
                    },
                });
            },
        });
    },
};
