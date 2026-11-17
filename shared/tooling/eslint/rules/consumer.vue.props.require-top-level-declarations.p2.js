import { getVariableDeclarator } from '#eslint/helpers/get-variable-declarator.js';
import { createVuePropsVisitor } from '#eslint/helpers/create-vue-props-visitor.js';

export default {
    meta: {
        type: 'suggestion',
        description: 'Declare defineProps variables at the top level of the script.',
        includeInReadme: true,
        schema: [],
        messages: {
            placement: 'Move the defineProps variable declaration to script top level. Preserve dependent references and review any surrounding function or conditional behavior during the move.',
        },
    },

    create(context) {
        return createVuePropsVisitor(context, {
            defineProps(node) {
                const statement = getVariableDeclarator(node)?.parent;

                if (statement && statement.parent.type !== 'Program') {
                    context.report({ node: node, messageId: 'placement' });
                }
            },
        });
    },
};
